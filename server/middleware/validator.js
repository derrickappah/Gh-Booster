function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
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
