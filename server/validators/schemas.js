const { z } = require('zod');

const registerSchema = z.object({
  fullname: z.string().min(1, 'Full name is required'),
  username: z.string().min(2, 'Username must be at least 2 characters').optional(),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  phone: z.string().refine(val => (val || '').replace(/[^0-9]/g, '').length >= 10, {
    message: 'Phone number must contain at least 10 digits'
  })
});

const loginSchema = z.object({
  username: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required')
});

const createOrderSchema = z.object({
  service_id: z.string().min(1, 'Service ID is required'),
  link: z.string().url('Link must be a valid URL').or(z.string().min(5, 'Valid link required')),
  quantity: z.number().int().positive('Quantity must be greater than 0').max(10000000, 'Quantity too large')
    .or(z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive('Quantity must be greater than 0').max(10000000, 'Quantity too large'))),
  comments: z.string().optional().nullable()
});

const depositSchema = z.object({
  amount_usd: z.number().positive('Deposit amount must be positive').max(50000, 'Deposit exceeds maximum limit')
    .or(z.string().transform(v => parseFloat(v)).pipe(z.number().positive('Deposit amount must be positive').max(50000, 'Deposit exceeds maximum limit')))
});

const ticketSchema = z.object({
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200, 'Subject must not exceed 200 characters'),
  message: z.string().min(5, 'Message content must be at least 5 characters').max(5000, 'Message must not exceed 5000 characters')
});

const adminCreateServiceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  category_id: z.string().min(1, 'Category ID is required'),
  rate_per_1k: z.number().nonnegative('Rate must not be negative')
    .or(z.string().transform(v => parseFloat(v)).pipe(z.number().nonnegative('Rate must not be negative'))),
  min_quantity: z.number().int().positive().optional()
    .or(z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive()).optional()),
  max_quantity: z.number().int().positive().optional()
    .or(z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive()).optional()),
  description: z.string().max(1000).optional().nullable(),
  status: z.preprocess(v => (typeof v === 'string' ? v.toLowerCase() : v), z.enum(['active', 'disabled'])).optional(),
  provider_service_id: z.string().max(200).optional().nullable(),
  provider_id: z.string().max(200).optional().nullable()
});

const adminCreateProviderSchema = z.object({
  name: z.string().min(1, 'Provider name is required').max(200),
  api_url: z.string().url('API URL must be valid'),
  api_key: z.string().min(1, 'API key is required'),
  status: z.preprocess(v => (typeof v === 'string' ? v.toLowerCase() : v), z.enum(['active', 'disabled', 'degraded', 'offline'])).optional()
});

const adminUpdateDepositStatusSchema = z.object({
  id: z.string().min(1, 'Transaction ID is required'),
  status: z.enum(['pending', 'completed', 'failed', 'expired', 'refunded'])
});

const adminUpdateBalanceSchema = z.object({
  userId: z.string().min(1, 'User ID is required').optional(),
  amount: z.number().positive('Amount must be positive').optional()
    .or(z.string().transform(v => parseFloat(v)).pipe(z.number().positive()).optional()),
  newBalance: z.number().nonnegative().optional()
    .or(z.string().transform(v => parseFloat(v)).pipe(z.number().nonnegative()).optional()),
  action: z.enum(['add', 'deduct']).optional(),
  reason: z.string().max(500).optional()
});

const adminUpdateOrderStatusSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required').optional(),
  status: z.enum(['Pending', 'Processing', 'In Progress', 'Completed', 'Partial', 'Canceled', 'Refunded'])
});

const adminReplyTicketSchema = z.object({
  ticketId: z.string().min(1, 'Ticket ID is required'),
  message: z.string().min(1, 'Message is required').max(5000)
});

const adminCreateBonusSchema = z.object({
  min_amount: z.number().nonnegative()
    .or(z.string().transform(v => parseFloat(v)).pipe(z.number().nonnegative())),
  bonus_percentage: z.number().min(0).max(100)
    .or(z.string().transform(v => parseFloat(v)).pipe(z.number().min(0).max(100))),
  gateway: z.string().max(100).optional(),
  status: z.preprocess(v => (typeof v === 'string' ? v.toLowerCase() : v), z.enum(['active', 'disabled'])).optional()
});

const adminCreatePromotionSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50),
  discount_percentage: z.number().min(0).max(100)
    .or(z.string().transform(v => parseFloat(v)).pipe(z.number().min(0).max(100))),
  max_uses: z.number().int().positive().optional()
    .or(z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive()).optional()),
  status: z.preprocess(v => (typeof v === 'string' ? v.toLowerCase() : v), z.enum(['active', 'expired', 'disabled'])).optional()
});

const adminCreateNewsSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required').max(10000),
  category: z.string().max(100).optional(),
  is_popup: z.boolean().optional()
});

const adminUpdateServiceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category_id: z.string().min(1).optional(),
  rate_per_1k: z.number().nonnegative().optional()
    .or(z.string().transform(v => parseFloat(v)).pipe(z.number().nonnegative()).optional()),
  min_quantity: z.number().int().positive().optional()
    .or(z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive()).optional()),
  max_quantity: z.number().int().positive().optional()
    .or(z.string().transform(v => parseInt(v, 10)).pipe(z.number().int().positive()).optional()),
  description: z.string().max(1000).optional().nullable(),
  status: z.preprocess(v => (typeof v === 'string' ? v.toLowerCase() : v), z.enum(['active', 'disabled'])).optional(),
  provider_service_id: z.string().max(200).optional().nullable(),
  provider_id: z.string().max(200).optional().nullable()
});

const adminUpdateChildPanelStatusSchema = z.object({
  id: z.string().min(1, 'Child Panel ID is required'),
  status: z.enum(['Pending', 'Active', 'Disabled', 'Canceled'])
});

const bulkOrderSchema = z.object({
  bulk_text: z.string().min(1, 'Bulk order text is required').max(50000, 'Bulk text exceeds limit'),
  service_id: z.string().optional()
});

const refillOrderSchema = z.object({
  order_id: z.string().optional()
});

const cancelOrderSchema = z.object({
  reason: z.string().max(500).optional()
});

module.exports = {
  registerSchema,
  loginSchema,
  createOrderSchema,
  depositSchema,
  ticketSchema,
  adminCreateServiceSchema,
  adminCreateProviderSchema,
  adminUpdateDepositStatusSchema,
  adminUpdateBalanceSchema,
  adminUpdateOrderStatusSchema,
  adminReplyTicketSchema,
  adminCreateBonusSchema,
  adminCreatePromotionSchema,
  adminCreateNewsSchema,
  adminUpdateServiceSchema,
  adminUpdateChildPanelStatusSchema,
  bulkOrderSchema,
  refillOrderSchema,
  cancelOrderSchema
};
