interface Props { message: string }
export function ErrorAlert({ message }: Props) {
  return (
    <div className="px-4 py-3 rounded-xl text-sm"
      style={{ background: '#fef2f2', color: '#dc2626' }}>
      {message}
    </div>
  )
}
