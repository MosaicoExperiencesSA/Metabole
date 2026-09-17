import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { InvitoGaiaController } from './invito-gaia.controller';

/**
 * La rotta dell'elenco con la validazione VERA (stessa configurazione di `main.ts`): i parametri
 * arrivano come testo dalla query, e un DTO che non li converte rifiuterebbe «pagina=2».
 */
describe('InvitoGaiaController — elenco (17/9)', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const tipoDto = Reflect.getMetadata('design:paramtypes', InvitoGaiaController.prototype, 'elenco')[0];
  const valida = (q: Record<string, string>) => pipe.transform(q, { type: 'query', metatype: tipoDto });

  it('accetta tipo, pagina e ricerca come arrivano dalla query', async () => {
    await expect(valida({ tipo: 'coda', pagina: '2', cerca: 'rossi' })).resolves.toEqual(
      expect.objectContaining({ tipo: 'coda', pagina: 2, cerca: 'rossi' }),
    );
    await expect(valida({ tipo: 'inviati' })).resolves.toEqual(expect.objectContaining({ tipo: 'inviati' }));
  });

  it('rifiuta tipi che non esistono, pagine strane e campi in più', async () => {
    await expect(valida({ tipo: 'tutti' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(valida({ tipo: 'coda', pagina: '0' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(valida({ tipo: 'coda', pagina: 'abc' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(valida({ tipo: 'coda', altro: '1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('passa i valori al servizio', async () => {
    const svc = { elenco: jest.fn().mockResolvedValue({ righe: [] }) };
    const c = new InvitoGaiaController(svc as never);
    await c.elenco({ tipo: 'scartati', pagina: 3, cerca: 'x@y' } as never);
    expect(svc.elenco).toHaveBeenCalledWith('scartati', 3, 'x@y');
  });
});
