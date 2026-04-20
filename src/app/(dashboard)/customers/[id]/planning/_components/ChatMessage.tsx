'use client'

interface Props {
  role: 'bot' | 'user'
  text: string
  onEdit?: () => void
}

export default function ChatMessage({ role, text, onEdit }: Props) {
  const isBot = role === 'bot'

  return (
    <div className={`flex gap-2 ${isBot ? 'justify-start' : 'justify-end'}`}>
      {isBot && (
        <div
          className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold"
          style={{ background: 'var(--color-primary)', color: '#fff' }}
        >
          P
        </div>
      )}
      <div className="flex flex-col gap-1 max-w-[80%]">
        <div
          className="px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap"
          style={
            isBot
              ? { background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderTopLeftRadius: 4 }
              : { background: 'var(--color-primary)', color: '#fff', borderTopRightRadius: 4 }
          }
        >
          {text}
        </div>
        {!isBot && onEdit && (
          <button
            onClick={onEdit}
            className="self-end text-xs flex items-center gap-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            修正
          </button>
        )}
      </div>
    </div>
  )
}
