export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// ===== Row 型（読み取り専用） =====

export interface CustomerRow {
  id: string; user_id: string; name_kanji: string; name_kana: string
  age: number | null; phone: string | null; email: string | null; line_id: string | null
  address: string | null; transport: string | null; inquiry_date: string | null
  status: string; notes: string | null; created_at: string; updated_at: string
}

export interface BabyRow {
  id: string; customer_id: string; name: string | null; birth_date: string | null
  due_date: string | null; sort_order: number; created_at: string
}

export interface FamilyMemberRow {
  id: string; customer_id: string; name: string; name_kana: string | null
  relation: string | null; gender: string | null; age: number | null
  allergies: string | null; sort_order: number; created_at: string
}

export interface SupportTagRow {
  id: string; user_id: string; name: string; is_default: boolean; sort_order: number; created_at: string
}

export interface VisitRow {
  id: string; customer_id: string; user_id: string; visit_date: string
  start_time: string | null; end_time: string | null; transport: string | null
  has_break: boolean; break_start: string | null; break_end: string | null
  customer_notes: string | null; customer_message: string | null
  next_visit_notes: string | null; staff_message: string | null
  drive_link: string | null
  report_sent: boolean; report_sent_at: string | null; created_at: string; updated_at: string
}

export interface VisitTagRow { id: string; visit_id: string; tag_id: string }

export interface ServiceRecordRow {
  id: string; visit_id: string; time_label: string; content: string | null
  detail: string | null; sort_order: number; created_at: string
}

export interface VisitPhotoRow {
  id: string; visit_id: string; user_id: string; file_path: string
  caption: string | null; sort_order: number; created_at: string
}

export interface PlanningPhotoRow {
  id: string; session_id: string; user_id: string; file_path: string
  caption: string | null; sort_order: number; created_at: string
}

export interface BreathCheckRow { id: string; visit_id: string; memo: string | null; created_at: string }

export interface BreathCheckCellRow {
  id: string; breath_check_id: string; hour_label: string; minute_value: number; checked: boolean
}

export interface CustomerActivityRow {
  id: string
  customer_id: string
  user_id: string
  type: 'material' | 'municipal' | 'other'
  activity_date: string
  title: string
  body: string | null
  staff_name: string | null
  municipality_name: string | null
  contact_person: string | null
  created_at: string
  updated_at: string
}

export interface BillingRow {
  id: string; customer_id: string; user_id: string
  contracted: boolean; invoiced: boolean; invoiced_date: string | null
  amount: number | null; paid: boolean; paid_date: string | null; notes: string | null
  created_at: string; updated_at: string
}

export interface CustomerContractRow {
  id: string; customer_id: string; user_id: string; title: string
  contracted_date: string; period_start: string | null; period_end: string | null
  notes: string | null; created_at: string; updated_at: string
}

export interface VisitBillingRow {
  id: string; visit_id: string; customer_id: string; user_id: string
  contract_id: string | null; invoice_label: string | null; amount: number | null
  invoiced: boolean; invoiced_date: string | null; paid: boolean; paid_date: string | null
  notes: string | null; created_at: string; updated_at: string
}

export interface InquiryRow {
  id: string; name_kanji: string; name_kana: string; phone: string; email: string
  address: string | null; due_date: string | null; baby_count: number | null
  allergies: string | null; support_tags: string[] | null; message: string | null
  is_processed: boolean; created_at: string
}

export interface UserProfileRow {
  user_id: string
  email: string | null
  display_name: string | null
  role: 'admin' | 'user' | 'supporter'
  onboarding_status: 'pending' | 'completed'
  subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled'
  photo_upload_enabled: boolean
  invited_by: string | null
  invited_at: string | null
  accepted_at: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  grace_until: string | null
  created_at: string
  updated_at: string
}

// ===== Database 型（Supabase クライアント用） =====

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: CustomerRow
        Insert: Omit<CustomerRow, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<CustomerRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      babies: {
        Row: BabyRow
        Insert: Omit<BabyRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<BabyRow, 'id' | 'created_at'>>
        Relationships: []
      }
      family_members: {
        Row: FamilyMemberRow
        Insert: Omit<FamilyMemberRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<FamilyMemberRow, 'id' | 'created_at'>>
        Relationships: []
      }
      support_tags: {
        Row: SupportTagRow
        Insert: Omit<SupportTagRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<SupportTagRow, 'id' | 'created_at'>>
        Relationships: []
      }
      visits: {
        Row: VisitRow
        Insert: Omit<VisitRow, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<VisitRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      visit_tags: {
        Row: VisitTagRow
        Insert: Omit<VisitTagRow, 'id'> & { id?: string }
        Update: Partial<Omit<VisitTagRow, 'id'>>
        Relationships: []
      }
      service_records: {
        Row: ServiceRecordRow
        Insert: Omit<ServiceRecordRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<ServiceRecordRow, 'id' | 'created_at'>>
        Relationships: []
      }
      visit_photos: {
        Row: VisitPhotoRow
        Insert: Omit<VisitPhotoRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<VisitPhotoRow, 'id' | 'created_at'>>
        Relationships: []
      }
      planning_photos: {
        Row: PlanningPhotoRow
        Insert: Omit<PlanningPhotoRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<PlanningPhotoRow, 'id' | 'created_at'>>
        Relationships: []
      }
      breath_checks: {
        Row: BreathCheckRow
        Insert: Omit<BreathCheckRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<BreathCheckRow, 'id' | 'created_at'>>
        Relationships: []
      }
      breath_check_cells: {
        Row: BreathCheckCellRow
        Insert: Omit<BreathCheckCellRow, 'id'> & { id?: string }
        Update: Partial<Omit<BreathCheckCellRow, 'id'>>
        Relationships: []
      }
      billing: {
        Row: BillingRow
        Insert: Omit<BillingRow, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<BillingRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      customer_contracts: {
        Row: CustomerContractRow
        Insert: Omit<CustomerContractRow, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<CustomerContractRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      visit_billing: {
        Row: VisitBillingRow
        Insert: Omit<VisitBillingRow, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<VisitBillingRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      inquiries: {
        Row: InquiryRow
        Insert: Omit<InquiryRow, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<InquiryRow, 'id' | 'created_at'>>
        Relationships: []
      }
      user_profiles: {
        Row: UserProfileRow
        Insert: Omit<UserProfileRow, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }
        Update: Partial<Omit<UserProfileRow, 'user_id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
      customer_activities: {
        Row: CustomerActivityRow
        Insert: Omit<CustomerActivityRow, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Omit<CustomerActivityRow, 'id' | 'created_at' | 'updated_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// 便利な型エイリアス
export type Customer = CustomerRow
export type CustomerInsert = Database['public']['Tables']['customers']['Insert']
export type Baby = BabyRow
export type FamilyMember = FamilyMemberRow
export type SupportTag = SupportTagRow
export type Visit = VisitRow
export type VisitTag = VisitTagRow
export type ServiceRecord = ServiceRecordRow
export type VisitPhoto = VisitPhotoRow
export type PlanningPhoto = PlanningPhotoRow
export type BreathCheck = BreathCheckRow
export type BreathCheckCell = BreathCheckCellRow
export type Billing = BillingRow
export type CustomerContract = CustomerContractRow
export type VisitBilling = VisitBillingRow
export type Inquiry = InquiryRow
export type CustomerActivity = CustomerActivityRow
export type UserProfile = UserProfileRow

// 拡張型
export type CustomerWithDetails = Customer & {
  babies: Baby[]
  family_members: FamilyMember[]
  billing: Billing | null
}

export type VisitWithDetails = Visit & {
  visit_tags: (VisitTag & { support_tags: SupportTag })[]
  service_records: ServiceRecord[]
  breath_checks: BreathCheck[]
}
