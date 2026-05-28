import { z } from 'zod'

export const babySchema = z.object({
  name: z.string().optional(),
  birth_date: z.string().optional(),
  due_date: z.string().optional(),
})

export const editBabySchema = babySchema.extend({
  id: z.string().optional(),
})

export const customerSchema = z.object({
  name_kanji: z.string().min(1, '氏名（漢字）は必須です'),
  name_kana: z.string().min(1, 'フリガナは必須です'),
  age: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('正しいメールアドレスを入力してください').optional().or(z.literal('')),
  line_id: z.string().optional(),
  address: z.string().optional(),
  transport: z.string().optional(),
  inquiry_date: z.string().optional(),
  status: z.string().default('活動中'),
  notes: z.string().optional(),
  babies: z.array(babySchema).default([]),
})

export const editCustomerSchema = customerSchema.extend({
  babies: z.array(editBabySchema).default([]),
})
