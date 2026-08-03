function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.url} - ${err.stack || err.message}`);

  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV !== 'development';
  const message = isProduction && statusCode === 500 ? 'Internal Server Error' : (err.message || 'Internal Server Error');

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(!isProduction && { stack: err.stack })
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
}

module.exports = { errorHandler, notFoundHandler };
