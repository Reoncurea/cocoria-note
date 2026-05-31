'use client'

type ContactActionsProps = {
  body: string
  email: string
  label: string
  subject: string
}

function buildGmailLink({
  body,
  email,
  subject,
}: {
  body: string
  email: string
  subject: string
}) {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: email,
    su: subject,
    body,
  })

  return `https://mail.google.com/mail/?${params.toString()}`
}

export function ContactActions({ body, email, label, subject }: ContactActionsProps) {
  const gmailLink = buildGmailLink({ body, email, subject })

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-3 text-left">
      <a href={gmailLink} target="_blank" rel="noreferrer" className="btn-primary block w-full text-center">
        {label}
      </a>

      <div className="rounded-xl p-3 text-xs space-y-2" style={{ background: 'var(--color-surface)' }}>
        <div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>送信先</p>
          <div className="flex items-center gap-2">
            <p className="break-all flex-1" style={{ color: 'var(--color-text-muted)' }}>{email}</p>
            <button
              type="button"
              onClick={() => copyText(email)}
              className="px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ background: '#fff', color: 'var(--color-primary-dark)' }}
            >
              コピー
            </button>
          </div>
        </div>

        <div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>件名</p>
          <div className="flex items-center gap-2">
            <p className="break-all flex-1" style={{ color: 'var(--color-text-muted)' }}>{subject}</p>
            <button
              type="button"
              onClick={() => copyText(subject)}
              className="px-3 py-1 rounded-lg text-xs font-semibold"
              style={{ background: '#fff', color: 'var(--color-primary-dark)' }}
            >
              コピー
            </button>
          </div>
        </div>

        <div>
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>本文</p>
          <p className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {body}
          </p>
          <button
            type="button"
            onClick={() => copyText(body)}
            className="mt-2 px-3 py-1 rounded-lg text-xs font-semibold"
            style={{ background: '#fff', color: 'var(--color-primary-dark)' }}
          >
            本文をコピー
          </button>
        </div>
      </div>
    </div>
  )
}
