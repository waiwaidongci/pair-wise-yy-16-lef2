import { useMemo, useState, type FormEvent } from 'react'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Fields {
  name: string
  email: string
  message: string
}

type Errors = Partial<Record<keyof Fields, string>>

function validate(fields: Fields): Errors {
  const errors: Errors = {}
  if (!fields.name.trim()) errors.name = '请填写你的姓名'
  if (!fields.email.trim()) errors.email = '请填写你的邮箱'
  else if (!EMAIL_RE.test(fields.email.trim())) errors.email = '请输入有效的邮箱地址'
  if (!fields.message.trim()) errors.message = '请写一点想聊的内容'
  return errors
}

export function Contact() {
  const [fields, setFields] = useState<Fields>({ name: '', email: '', message: '' })
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({})
  const [phase, setPhase] = useState<'editing' | 'sending' | 'sent'>('editing')

  const errors = useMemo(() => validate(fields), [fields])
  const isValid = Object.keys(errors).length === 0

  const set = (key: keyof Fields) => (e: { target: { value: string } }) =>
    setFields(f => ({ ...f, [key]: e.target.value }))
  const blur = (key: keyof Fields) => () => setTouched(t => ({ ...t, [key]: true }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setTouched({ name: true, email: true, message: true })
    if (!isValid) return
    setPhase('sending')
    // 前端模拟发送，无真实后端
    window.setTimeout(() => setPhase('sent'), 800)
  }

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">联系</p>
        <h1>约一次拍摄，或聊聊高原</h1>
        <p className="lede">无论是人像委托、高原同行，还是只是想说说话，都欢迎来信。</p>
      </header>

      <div className="contact-grid">
        {phase === 'sent' ? (
          <section className="form-success" role="status">
            <h2>谢谢你的来信</h2>
            <p>消息已经收到。我会在两个工作日内回复你；如果恰逢在高原拍摄，可能稍慢一些，但一定会回。</p>
          </section>
        ) : (
          <form className="contact-form" noValidate onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="contact-name">姓名</label>
              <input
                id="contact-name"
                type="text"
                value={fields.name}
                onChange={set('name')}
                onBlur={blur('name')}
                aria-invalid={Boolean(touched.name && errors.name)}
              />
              {touched.name && errors.name && <p className="field-error">{errors.name}</p>}
            </div>
            <div className="field">
              <label htmlFor="contact-email">邮箱</label>
              <input
                id="contact-email"
                type="email"
                value={fields.email}
                onChange={set('email')}
                onBlur={blur('email')}
                aria-invalid={Boolean(touched.email && errors.email)}
              />
              {touched.email && errors.email && <p className="field-error">{errors.email}</p>}
            </div>
            <div className="field">
              <label htmlFor="contact-message">留言</label>
              <textarea
                id="contact-message"
                rows={5}
                value={fields.message}
                onChange={set('message')}
                onBlur={blur('message')}
                aria-invalid={Boolean(touched.message && errors.message)}
              />
              {touched.message && errors.message && <p className="field-error">{errors.message}</p>}
            </div>
            <button type="submit" className="submit-button" disabled={!isValid || phase === 'sending'}>
              {phase === 'sending' ? '发送中…' : '发送消息'}
            </button>
          </form>
        )}

        <aside className="contact-aside">
          <h2>合作范围</h2>
          <p>人像特写委托、高原随行记录、牧场与纪实题材的长期项目。</p>
          <p className="aside-note">来信请尽量写明时间、地点与期望的呈现方式，方便更快进入正题。</p>
        </aside>
      </div>
    </main>
  )
}
