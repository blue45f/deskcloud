import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { APP_CONFIG, type AppConfig } from '../config'

import { ApiKeyGuard } from './api-key.guard'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { SessionGuard } from './session.guard'

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig) => ({
        secret: cfg.jwtSecret,
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, ApiKeyGuard],
  exports: [JwtModule, SessionGuard, ApiKeyGuard, AuthService],
})
export class AuthModule {}
