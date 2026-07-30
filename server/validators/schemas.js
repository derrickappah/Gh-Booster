const { z } = require('zod');

const registerSchema = z.object({
  fullname: z.string().min(1, 'Full name is required').optional(),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits')
});

const loginSchema = z.object({
  username: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required')
});

const createOrderSchema = z.object({
  service_id: z.string().min(1, 'Service ID is required'),
  link: z.string().url('Link must be a valid URL').or(z.string().min(5, 'Valid link required')),
  quantity: z.number().int().positive('Quantity must be greater than 0').or(z.string().transform(v => parseInt(v, 10)))
});

const depositSchema = z.object({
  amount_usd: z.number().positive('Deposit amount must be positive').or(z.string().transform(v => parseFloat(v)))
});

const ticketSchema = z.object({
  subject: z.string().min(3, 'Subject must be at least 3 characters'),
  message: z.string().min(5, 'Message content must be at least 5 characters')
});

module.exports = {
  registerSchema,
  loginSchema,
  createOrderSchema,
  depositSchema,
  ticketSchema
};
