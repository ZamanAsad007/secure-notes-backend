/**
 * Parses page and limit from query parameters and clamps values.
 * Default page: 1, Default limit: 10, Limit max: 50.
 *
 * @param {object} query - Express req.query object
 * @returns {{ page: number, limit: number, skip: number }}
 */
const getPagination = (query = {}) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (isNaN(page) || page < 1) {
    page = 1;
  }

  if (isNaN(limit) || limit < 1) {
    limit = 10;
  } else if (limit > 50) {
    limit = 50;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Formats data and pagination metadata into standard response shape.
 *
 * @param {{ data: Array, page: number, limit: number, total: number }} options
 * @returns {{ data: Array, pagination: { page: number, limit: number, total: number, totalPages: number } }}
 */
const formatPaginatedResponse = ({ data = [], page = 1, limit = 10, total = 0 }) => {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  };
};

module.exports = {
  getPagination,
  formatPaginatedResponse
};
