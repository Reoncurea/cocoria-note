export const ACTIVITY_TYPES = {
  material:  { value: 'material',  label: '資料提供',   bg: '#dbeafe', color: '#1e40af' },
  municipal: { value: 'municipal', label: '自治体連携', bg: '#dcfce7', color: '#166534' },
  other:     { value: 'other',     label: 'その他',     bg: '#f3f4f6', color: '#374151' },
} as const

export const ACTIVITY_TYPE_OPTIONS = Object.values(ACTIVITY_TYPES).map(t => ({ value: t.value, label: t.label }))
