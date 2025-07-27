import { z } from 'zod';

export const curatorLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const curatorSignupSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type CuratorLoginInput = z.infer<typeof curatorLoginSchema>;
export type CuratorSignupInput = z.infer<typeof curatorSignupSchema>;
