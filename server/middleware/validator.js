function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      if (err.errors) {
        const errorMsg = err.errors.map(e => e.message).join(', ');
        return res.status(400).json({ success: false, error: errorMsg });
      }
      return res.status(400).json({ success: false, error: 'Validation error: ' + err.message });
    }
  };
}

module.exports = { validate };
