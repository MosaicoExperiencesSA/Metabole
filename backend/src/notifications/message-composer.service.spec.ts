import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ConfigParamsService } from '../config-params/config-params.service';
import { I18nService } from '../i18n/i18n.service';
import { MessageComposerService } from './message-composer.service';

describe('MessageComposerService (layer AI di supporto, spec 7.2)', () => {
  let configGet: jest.Mock;
  let paramGet: jest.Mock;
  let composer: MessageComposerService;

  const build = async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MessageComposerService,
        I18nService,
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: ConfigParamsService, useValue: { getString: paramGet, getNumber: jest.fn() } },
      ],
    }).compile();
    composer = moduleRef.get(MessageComposerService);
  };

  afterEach(() => {
    (global.fetch as unknown as jest.Mock | undefined)?.mockRestore?.();
  });

  it('senza AI_API_KEY usa i template (composer: template)', async () => {
    configGet = jest.fn().mockReturnValue(undefined);
    paramGet = jest.fn().mockResolvedValue('true');
    await build();
    const out = await composer.compose({ locale: 'it', key: 'engine_daily_celebratory', tone: 'celebratory' });
    expect(out.composer).toBe('template');
    expect(out.title).toContain('Traguardo');
  });

  it('con chiave ma parametro ai_composer_enabled=false resta sui template', async () => {
    configGet = jest.fn((k: string) => (k === 'AI_API_KEY' ? 'sk-ant-test-1234567890' : undefined));
    paramGet = jest.fn().mockResolvedValue('false');
    await build();
    const fetchSpy = jest.spyOn(global, 'fetch' as never);
    const out = await composer.compose({ locale: 'it', key: 'checkin_reminder' });
    expect(out.composer).toBe('template');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('AI attiva: riformula il corpo ma il TONO resta quello del motore', async () => {
    configGet = jest.fn((k: string) => (k === 'AI_API_KEY' ? 'sk-ant-test-1234567890' : undefined));
    paramGet = jest.fn().mockResolvedValue('true');
    await build();
    (jest.spyOn(global, 'fetch' as never) as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'Messaggio riformulato con dolcezza.' }] }),
    });
    const out = await composer.compose({ locale: 'it', key: 'engine_daily_gentle', tone: 'gentle' });
    expect(out.composer).toBe('ai');
    expect(out.body).toBe('Messaggio riformulato con dolcezza.');
    // il tono è passato all'AI come vincolo, mai deciso da lei
    const req = (global.fetch as unknown as jest.Mock).mock.calls[0][1];
    expect(req.body).toContain('delicato');
  });

  it('AI in errore → fallback silenzioso al template', async () => {
    configGet = jest.fn((k: string) => (k === 'AI_API_KEY' ? 'sk-ant-test-1234567890' : undefined));
    paramGet = jest.fn().mockResolvedValue('true');
    await build();
    (jest.spyOn(global, 'fetch' as never) as unknown as jest.Mock).mockRejectedValue(new Error('rete giù'));
    const out = await composer.compose({ locale: 'it', key: 'checkin_reminder' });
    expect(out.composer).toBe('template');
    expect(out.body.length).toBeGreaterThan(0);
  });

  it('risposta AI vuota o abnorme → template', async () => {
    configGet = jest.fn((k: string) => (k === 'AI_API_KEY' ? 'sk-ant-test-1234567890' : undefined));
    paramGet = jest.fn().mockResolvedValue('true');
    await build();
    (jest.spyOn(global, 'fetch' as never) as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'x'.repeat(600) }] }),
    });
    const out = await composer.compose({ locale: 'it', key: 'checkin_reminder' });
    expect(out.composer).toBe('template');
  });
});
