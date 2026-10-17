# Aterosclerose coronária (figura interativa)

Figura isométrica interativa, feita com a skill `anatomy`: um corte transversal de artéria coronária preso a um suporte giratório. O seletor de estágio anda num sulco na borda do suporte (de 0, artéria saudável, a 6, ruptura com trombo) e o manômetro lê a estenose do lúmen.

- `aterosclerose.html` (tema escuro) e `aterosclerose-light.html` (tema claro): páginas independentes, é só abrir no navegador.
- Mouse, toque nos estágios, setas do teclado (Home/End) ou o passeio automático controlam o tempo.
- `model.mjs`: o modelo (carga de placa, remodelamento de Glagov, estenose). Tudo o que a figura mostra sai dele.
- `scene.mjs`: geometria que se redesenha a cada quadro. `build.mjs`: monta as páginas.
- `vendor/`: o kit isométrico da skill (licença MIT).

```sh
node build.mjs          # aterosclerose.html
node build.mjs --light  # aterosclerose-light.html
```

Modelo didático: as áreas seguem o remodelamento de Glagov (até ~40% de carga o lúmen se preserva); a escala de tempo é qualitativa (décadas).
