import { Inject, Injectable, Logger } from '@nestjs/common'

import { APP_CONFIG, type AppConfig } from '../config'

import type { ChannelAdapter, DeliveryInput, DeliveryOutcome } from './channel.types'
import type { Channel } from '@notifydesk/shared'

/**
 * 이메일 채널 — pluggable 어댑터.
 * - SMTP_URL 미설정(기본): 콘솔 로그 어댑터(이메일 본문을 stdout 에 출력).
 * - SMTP_URL 설정 시: nodemailer 동적 임포트로 SMTP 발송(의존성 없으면 우아하게 콘솔 폴백).
 *
 * 수신자 email 이 없으면 skipped('no-email').
 */
@Injectable()
export class EmailAdapter implements ChannelAdapter {
  readonly channel: Channel = 'email'
  private readonly logger = new Logger('EmailChannel')
  private transport: { sendMail: (opts: unknown) => Promise<unknown> } | null = null
  private transportTried = false

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  private async getTransport(): Promise<{ sendMail: (opts: unknown) => Promise<unknown> } | null> {
    if (this.transportTried) return this.transport
    this.transportTried = true
    if (!this.cfg.email.smtpUrl) return null
    try {
      // nodemailer 는 선택 의존성 — 설치돼 있을 때만 SMTP 경로 사용.
      // (변수 스펙으로 동적 임포트해 미설치 시 타입 해석 의존성을 만들지 않는다.)
      const moduleName = 'nodemailer'
      const mod = (await import(/* @vite-ignore */ moduleName).catch(() => null)) as {
        createTransport?: (url: string) => { sendMail: (opts: unknown) => Promise<unknown> }
      } | null
      if (!mod?.createTransport) {
        this.logger.warn('SMTP_URL 이 설정됐지만 nodemailer 가 설치되지 않아 콘솔 폴백합니다.')
        return null
      }
      this.transport = mod.createTransport(this.cfg.email.smtpUrl)
      this.logger.log('SMTP 트랜스포트 준비 완료')
      return this.transport
    } catch (err) {
      this.logger.warn(`SMTP 트랜스포트 생성 실패(콘솔 폴백): ${(err as Error).message}`)
      return null
    }
  }

  async deliver(input: DeliveryInput): Promise<DeliveryOutcome> {
    const to = input.email ?? (typeof input.data?.email === 'string' ? input.data.email : undefined)
    if (!to) {
      return { status: 'skipped', detail: 'no-email' }
    }

    const transport = await this.getTransport()
    if (!transport) {
      // 콘솔 로그 어댑터(기본) — 실제 전송 대신 출력.
      this.logger.log(`[email→${to}] ${input.title}\n${input.body}  (from: ${this.cfg.email.from})`)
      return { status: 'delivered', detail: 'console' }
    }

    try {
      await transport.sendMail({
        from: this.cfg.email.from,
        to,
        subject: input.title,
        text: input.body,
      })
      return { status: 'delivered', detail: 'smtp' }
    } catch (err) {
      this.logger.error(`SMTP 발송 실패: ${(err as Error).message}`)
      return { status: 'failed', detail: 'smtp-error' }
    }
  }
}
