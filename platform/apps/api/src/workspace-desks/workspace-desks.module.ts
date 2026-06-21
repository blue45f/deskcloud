import { Module } from '@nestjs/common'

import { WorkspaceDesksController } from './workspace-desks.controller'

@Module({ controllers: [WorkspaceDesksController] })
export class WorkspaceDesksModule {}
