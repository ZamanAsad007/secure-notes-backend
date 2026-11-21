const mongoose = require('mongoose');
const config = require('../src/config/env');
const User = require('../src/models/User');
const Note = require('../src/models/Note');
const Post = require('../src/models/Post');

/**
 * Recursively search execution plan stages for a stage matching stageName (e.g. 'IXSCAN' or 'COLLSCAN')
 */
function findStage(stage, stageName) {
  if (!stage) return null;
  if (stage.stage === stageName) return stage;

  if (stage.inputStage) {
    const found = findStage(stage.inputStage, stageName);
    if (found) return found;
  }

  if (Array.isArray(stage.inputStages)) {
    for (const sub of stage.inputStages) {
      const found = findStage(sub, stageName);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Extracts index name from an execution plan (handles query plans, sharded plans, and aggregate pipeline stages)
 */
function extractIndexUsage(explainResult) {
  // If aggregate explain with stages
  if (Array.isArray(explainResult?.stages)) {
    for (const s of explainResult.stages) {
      if (s.$cursor?.executionStats?.executionStages) {
        const ixScan = findStage(s.$cursor.executionStats.executionStages, 'IXSCAN');
        if (ixScan) return { stage: 'IXSCAN', indexName: ixScan.indexName, stats: s.$cursor.executionStats };
        const collScan = findStage(s.$cursor.executionStats.executionStages, 'COLLSCAN');
        if (collScan) return { stage: 'COLLSCAN', indexName: null, stats: s.$cursor.executionStats };
      }
    }
  }

  // If standard query explain
  const execStages = explainResult?.executionStats?.executionStages;
  if (execStages) {
    const ixScan = findStage(execStages, 'IXSCAN');
    if (ixScan) {
      return { stage: 'IXSCAN', indexName: ixScan.indexName, stats: explainResult.executionStats };
    }
    const collScan = findStage(execStages, 'COLLSCAN');
    if (collScan) {
      return { stage: 'COLLSCAN', indexName: null, stats: explainResult.executionStats };
    }
    return { stage: execStages.stage, indexName: execStages.indexName || null, stats: explainResult.executionStats };
  }

  // Fallback to queryPlanner
  const winning = explainResult?.queryPlanner?.winningPlan;
  if (winning) {
    const ixScan = findStage(winning, 'IXSCAN');
    if (ixScan) return { stage: 'IXSCAN', indexName: ixScan.indexName };
  }

  return { stage: 'UNKNOWN', indexName: null };
}

async function runIndexAudit() {
  console.log('='.repeat(78));
  console.log('🔍 SECURE NOTE-TAKING APPLICATION — MONGODB INDEX AUDIT');
  console.log('='.repeat(78));

  try {
    await mongoose.connect(config.MONGODB_URI);

    console.log('\n[1/4] Ensuring indexes exist across all collections via syncIndexes()...');
    await User.syncIndexes();
    await Note.syncIndexes();
    await Post.syncIndexes();
    console.log('✔ User, Note, and Post indexes verified and in sync.\n');

    // Retrieve sample records for parameterized explain queries
    const sampleUser = (await User.findOne()) || { _id: new mongoose.Types.ObjectId(), email: 'admin@example.com' };
    const sampleInterest = sampleUser.interests?.[0] || 'cryptography';

    console.log('[2/4] Executing query execution plans (.explain("executionStats"))...\n');

    const testSuites = [
      {
        name: 'Query 1: Notes Vault Query (by Owner with _id descending sort)',
        description: 'Note.find({ owner }).sort({ _id: -1 }).limit(10)',
        expectedIndex: 'owner_1__id_-1',
        run: async () => {
          return await Note.find({ owner: sampleUser._id })
            .sort({ _id: -1 })
            .limit(10)
            .explain('executionStats');
        }
      },
      {
        name: 'Query 2: Posts Timeline Query (by Author with _id descending sort)',
        description: 'Post.find({ author }).sort({ _id: -1 }).limit(10)',
        expectedIndex: 'author_1__id_-1',
        run: async () => {
          return await Post.find({ author: sampleUser._id })
            .sort({ _id: -1 })
            .limit(10)
            .explain('executionStats');
        }
      },
      {
        name: 'Query 3: User Authentication Query (by unique email)',
        description: 'User.findOne({ email })',
        expectedIndex: 'email_1',
        run: async () => {
          return await User.findOne({ email: sampleUser.email }).explain('executionStats');
        }
      },
      {
        name: 'Query 4: Filtered Interests Aggregation (Scenario 1 with ?interest=)',
        description: 'User.aggregate([{ $match: { interests } }, ...])',
        expectedIndex: 'interests_1',
        run: async () => {
          return await User.aggregate([
            { $match: { interests: sampleInterest } },
            { $unwind: '$interests' },
            { $match: { interests: sampleInterest } },
            { $group: { _id: '$interests', count: { $sum: 1 } } }
          ]).explain('executionStats');
        }
      },
      {
        name: 'Query 5: Users List Pagination (Default _id_ index)',
        description: 'User.find({}).sort({ _id: -1 }).limit(10)',
        expectedIndex: '_id_',
        run: async () => {
          return await User.find({}).sort({ _id: -1 }).limit(10).explain('executionStats');
        }
      }
    ];

    let passedCount = 0;

    for (const test of testSuites) {
      console.log(`-`.repeat(78));
      console.log(`📌 ${test.name}`);
      console.log(`   Pattern:        ${test.description}`);
      console.log(`   Expected Index: ${test.expectedIndex}`);

      const explainResult = await test.run();
      const usage = extractIndexUsage(explainResult);

      const isIndexMatch = usage.indexName === test.expectedIndex;
      const isIxScan = usage.stage === 'IXSCAN';

      if (isIxScan && isIndexMatch) {
        console.log(`   Result:         ✅ PASS`);
        console.log(`   Execution:      Stage: ${usage.stage} | Index: ${usage.indexName}`);
        if (usage.stats) {
          console.log(
            `   Stats:          docsExamined: ${usage.stats.totalDocsExamined} | keysExamined: ${usage.stats.totalKeysExamined} | execTime: ${usage.stats.executionTimeMillis}ms`
          );
        }
        passedCount++;
      } else {
        console.log(`   Result:         ❌ FAIL`);
        console.log(`   Execution:      Stage: ${usage.stage} | Index: ${usage.indexName || 'NONE'}`);
        throw new Error(
          `Index audit failure for ${test.name}: expected index ${test.expectedIndex}, but got ${usage.indexName} (stage: ${usage.stage})`
        );
      }
    }

    console.log(`-`.repeat(78));
    console.log('\n[3/4] Documenting Scenario 1 Unfiltered Aggregation Tradeoff...');
    console.log('   Pattern: User.aggregate([{ $unwind: "$interests" }, { $group: ... }])');
    console.log(
      '   Analysis: When no ?interest= filter is provided, MongoDB must process all registered users'
    );
    console.log(
      '   across the entire collection to assemble complete directory totals. Unfiltered unwinding'
    );
    console.log(
      '   will legitimately perform a full collection scan (COLLSCAN) by design, whereas any filtered'
    );
    console.log(
      '   query (?interest=...) immediately anchors to index #2 (interests_1) via an initial $match stage.'
    );

    console.log('\n[4/4] Summary');
    console.log(`✔ All ${passedCount} target queries verified to use optimal indexes with 0 COLLSCANs.`);
    console.log('='.repeat(78));
    console.log('🎉 INDEX AUDIT COMPLETE: ALL ASSERTIONS PASSED');
    console.log('='.repeat(78));

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Audit failed with error:', err.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    process.exit(1);
  }
}

if (require.main === module) {
  runIndexAudit();
}

module.exports = { runIndexAudit, extractIndexUsage };
