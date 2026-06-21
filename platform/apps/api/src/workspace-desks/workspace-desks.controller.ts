import {
  getWorkspaceDesksManifest,
  workspaceDeskManifestById,
  type WorkspaceDeskManifestItem,
  type WorkspaceDesksManifestDto,
} from '@desk/shared'
import { Controller, Get, NotFoundException, Param } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'

@ApiTags('workspace-desks')
@SkipThrottle()
@Controller('workspace-desks')
export class WorkspaceDesksController {
  @Get()
  @ApiOperation({
    summary: 'DeskCloud workspace Desk 통합 manifest',
    description:
      'deskcloud 모노레포로 흡수된 non-native Desk의 source-of-truth, control-plane, data-plane, gateway 경계를 반환합니다.',
  })
  list(): WorkspaceDesksManifestDto {
    return getWorkspaceDesksManifest()
  }

  @Get(':id')
  @ApiOperation({ summary: '단일 workspace Desk 통합 manifest' })
  @ApiParam({ name: 'id', enum: ['seo-gateway', 'remote-devtools'] })
  get(@Param('id') id: string): WorkspaceDeskManifestItem {
    const item = workspaceDeskManifestById(id)
    if (!item) throw new NotFoundException(`Unknown workspace Desk: ${id}`)
    return item
  }
}
