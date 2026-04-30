import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiModule } from '../ai/ai.module';
import { TRACE_ANCHOR_PROVIDER_KEY } from './trace.constants';
import {
  TRACE_ANCHOR_PROVIDER,
  type TraceAnchorProvider,
} from './interfaces/trace-anchor-provider.interface';
import {
  TRACE_PROOF_PROVIDER,
  type TraceProofProvider,
} from './interfaces/trace-proof-provider.interface';
import { EvmAnchorProvider } from './providers/evm-anchor.provider';
import { HashProofProvider } from './providers/hash-proof.provider';
import { NotaryAnchorProvider } from './providers/notary-anchor.provider';
import { TraceController } from './trace.controller';
import { TraceService } from './trace.service';

@Module({
  imports: [AiModule, ConfigModule],
  controllers: [TraceController],
  providers: [
    TraceService,
    HashProofProvider,
    NotaryAnchorProvider,
    EvmAnchorProvider,
    {
      provide: TRACE_PROOF_PROVIDER,
      inject: [HashProofProvider],
      useFactory: (hashProofProvider: HashProofProvider): TraceProofProvider => {
        return hashProofProvider;
      },
    },
    {
      provide: TRACE_ANCHOR_PROVIDER,
      inject: [ConfigService, HashProofProvider, NotaryAnchorProvider, EvmAnchorProvider],
      useFactory: (
        configService: ConfigService,
        hashProofProvider: HashProofProvider,
        notaryAnchorProvider: NotaryAnchorProvider,
        evmAnchorProvider: EvmAnchorProvider,
      ): TraceAnchorProvider => {
        const providerMode =
          configService.get<string>('trace.anchorProvider')?.toLowerCase() ||
          TRACE_ANCHOR_PROVIDER_KEY.HASH;

        switch (providerMode) {
          case TRACE_ANCHOR_PROVIDER_KEY.EVM:
            return evmAnchorProvider;
          case TRACE_ANCHOR_PROVIDER_KEY.NOTARY:
            return notaryAnchorProvider;
          case TRACE_ANCHOR_PROVIDER_KEY.HASH:
          default:
            return hashProofProvider;
        }
      },
    },
  ],
  exports: [TraceService, TRACE_PROOF_PROVIDER, TRACE_ANCHOR_PROVIDER],
})
export class TraceModule {}
