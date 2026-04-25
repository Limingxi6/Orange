import { ApiProperty } from '@nestjs/swagger';
import {
  TRACE_ANCHOR_STATUS_VALUES,
  TRACE_PROOF_TYPE,
  TRACE_VERIFY_STATUS,
} from '../trace.constants';

export class VerifyTraceDataDto {
  @ApiProperty({ example: 'P1-B1001-KS8Q1A' })
  traceCode: string;

  @ApiProperty({ example: true })
  exists: boolean;

  @ApiProperty({ example: true })
  verified: boolean;

  @ApiProperty({
    enum: Object.values(TRACE_VERIFY_STATUS),
    example: TRACE_VERIFY_STATUS.VERIFIED,
  })
  status: string;

  @ApiProperty({ example: '哈希校验通过' })
  message: string;

  @ApiProperty({ example: TRACE_PROOF_TYPE.HASH })
  proofType: string;

  @ApiProperty({
    example: 'd7c3dd4af06d9dcf40b2b2b8bfa19ac0f897...',
    nullable: true,
  })
  proofHash: string | null;

  @ApiProperty({
    enum: TRACE_ANCHOR_STATUS_VALUES,
    example: 'not_anchored',
  })
  anchorStatus: string;

  @ApiProperty({
    example: '0xabc123...',
    nullable: true,
  })
  txId: string | null;

  @ApiProperty({
    example: '128',
    nullable: true,
  })
  blockNumber: string | null;

  @ApiProperty({
    example: 'evm',
    nullable: true,
  })
  chainProvider: string | null;

  @ApiProperty({
    example: 'sepolia',
    nullable: true,
  })
  chainNetwork: string | null;

  @ApiProperty({
    example: '2026-04-21T09:30:00.000Z',
    nullable: true,
  })
  anchoredAt: Date | null;

  @ApiProperty({
    example: 'd7c3dd4af06d9dcf40b2b2b8bfa19ac0f897...',
    nullable: true,
  })
  chainHash: string | null;
}
