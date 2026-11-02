/** Lee como máximo el límite real, también con transferencia por bloques. */
export async function cuerpoLimitado(request: Request, limite: number): Promise<Response | null> {
  if (Number(request.headers.get('content-length')) > limite) return null;
  const lector = request.body?.getReader();
  const bloques: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  if (lector) {
    try {
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        total += value.byteLength;
        if (total > limite) {
          await lector.cancel();
          return null;
        }
        bloques.push(new Uint8Array(value));
      }
    } finally {
      lector.releaseLock();
    }
  }
  return new Response(new Blob(bloques), { headers: request.headers });
}
