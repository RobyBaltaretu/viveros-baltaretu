import {expect,it} from 'vitest';
import {resolverPerfil,PERFILES} from '../../src/server/simulador/perfiles';
import {esquemaVisual} from '../../src/server/catalogo/visual';
it('separa las opciones de cocina, baño y armario y rechaza cruces',()=>{
expect(resolverPerfil('bano',{montaje:'Suspendido'}).opciones.montaje).toBe('Suspendido');
expect(PERFILES.armario.zonas).not.toContain('encimera');
expect(resolverPerfil('armario',{}).opciones).not.toHaveProperty('lavabo');
expect(()=>resolverPerfil('bano',{montaje:'Con isla'})).toThrow();
});
it('la ficha visual es opcional pero sus URLs, colores y escala se validan',()=>{
expect(esquemaVisual.safeParse({}).success).toBe(true);
expect(esquemaVisual.safeParse({colorHex:'#998877',uso:['mueble'],fuente:'https://www.egger.com/'}).success).toBe(true);
for(const x of [{textura:'file:///etc/passwd'},{colorHex:'roble'},{escalaAnchoMm:-1},{reformas:['otra']}])expect(esquemaVisual.safeParse(x).success).toBe(false);
});
