import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import {
  createSurveySchema,
  updateSurveySchema,
  type CreateSurveyInput,
  type ResponseListDto,
  type SurveyDto,
  type SurveySummary,
  type UpdateSurveyInput,
} from '@surveydesk/shared'

import { ZodValidationPipe } from '../common/zod.pipe'
import { SurveysService } from '../surveys/surveys.service'

import { AdminTokenGuard } from './admin-token.guard'

import type { Response } from 'express'

/** 어드민(X-Admin-Token) — 응답 목록·집계 + 설문 구성 CRUD/활성화. */
@ApiTags('admin')
@ApiHeader({ name: 'X-Admin-Token', required: true, description: 'ADMIN_TOKEN 과 일치해야 합니다' })
@Controller('admin/surveys/:appId')
@UseGuards(AdminTokenGuard)
export class AdminSurveysController {
  constructor(private readonly surveys: SurveysService) {}

  @Get('responses')
  @ApiParam({ name: 'appId', example: 'demo' })
  @ApiOperation({ summary: '응답 목록(최신순, 페이지네이션 offset/limit)' })
  async listResponses(
    @Param('appId') appId: string,
    @Res({ passthrough: true }) res: Response,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string
  ): Promise<ResponseListDto> {
    const result = await this.surveys.listResponses(appId, { offset, limit })
    res.setHeader('X-Total-Count', String(result.total))
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
    return result
  }

  @Get('summary')
  @ApiParam({ name: 'appId', example: 'demo' })
  @ApiOperation({
    summary: '집계 — 응답 수·평균 별점·NPS·선택지 분포·최근 자유서술(활성/최신 버전 기준)',
  })
  summary(@Param('appId') appId: string): Promise<SurveySummary> {
    return this.surveys.summary(appId)
  }

  @Get()
  @ApiParam({ name: 'appId', example: 'demo' })
  @ApiOperation({ summary: '설문 목록(버전 이력, 최신순)' })
  listSurveys(@Param('appId') appId: string): Promise<SurveyDto[]> {
    return this.surveys.listSurveys(appId)
  }

  @Get(':version')
  @ApiParam({ name: 'appId', example: 'demo' })
  @ApiParam({ name: 'version', example: 1 })
  @ApiOperation({ summary: '설문 단건(특정 버전)' })
  getSurvey(
    @Param('appId') appId: string,
    @Param('version', ParseIntPipe) version: number
  ): Promise<SurveyDto> {
    return this.surveys.getSurvey(appId, version)
  }

  @Post()
  @ApiParam({ name: 'appId', example: 'demo' })
  @ApiOperation({ summary: '설문 생성 — 새 버전(자동 증가, 비활성 상태). activate 로 활성화' })
  create(
    @Param('appId') appId: string,
    @Body(new ZodValidationPipe(createSurveySchema)) body: CreateSurveyInput
  ): Promise<SurveyDto> {
    return this.surveys.createSurvey(appId, body)
  }

  @Put(':version')
  @ApiParam({ name: 'appId', example: 'demo' })
  @ApiParam({ name: 'version', example: 1 })
  @ApiOperation({ summary: '설문(특정 버전) 수정' })
  update(
    @Param('appId') appId: string,
    @Param('version', ParseIntPipe) version: number,
    @Body(new ZodValidationPipe(updateSurveySchema)) body: UpdateSurveyInput
  ): Promise<SurveyDto> {
    return this.surveys.updateSurvey(appId, version, body)
  }

  @Post(':version/activate')
  @ApiParam({ name: 'appId', example: 'demo' })
  @ApiParam({ name: 'version', example: 1 })
  @ApiOperation({ summary: '설문(특정 버전) 활성화 — 기존 활성본은 자동 비활성' })
  activate(
    @Param('appId') appId: string,
    @Param('version', ParseIntPipe) version: number
  ): Promise<SurveyDto> {
    return this.surveys.activateSurvey(appId, version)
  }
}
