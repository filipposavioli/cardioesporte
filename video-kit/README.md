# Video Kit — Cardioesporte

Templates de thumbnail e motion graphics para vídeos educativos do Dr. Filippo Savioli,
inspirados no padrão de edição de canais médicos (referência: Dr. Khadija Siddiqui,
"Fastest Way To Lose Visceral Fat").

> **Regra:** nenhuma peça é publicada sem confirmação explícita do Dr. Filippo.

## Identidade

| Item | Valor |
|---|---|
| Assinatura | Dr. Filippo Savioli · Cardiologia do Esporte · CRM-SP 151.154 |
| Logo | Fonte original mantida. Versão para vídeo: símbolo + "cardio" em verde, "esporte" em branco (`assets/logo_verde_branco.png`) |
| Tom de voz | Técnico, preciso, próximo. "Seu corpo tem dados. Nós interpretamos." |
| Palavras-chave | Saúde, dados, exercício, ciência, fisiologia, segurança, performance, individualização, prevenção, evolução, precisão, hábitos |

### Paleta (moodboard, "Caminho 1")

| Nome | HEX | Uso |
|---|---|---|
| Azul Petróleo | `#021B3A` | Fundos, texto sobre verde |
| Azul Medium | `#006C92` | Apoio, tags, gráficos secundários |
| Verde Saúde | `#9FC742` | Destaque único: caixa de palavra-chave, marcação, números, ECG |
| Cinza Concreto | `#BDBEC0` | Texto de apoio |
| Grafite | `#1C1D21` | Fundos alternativos, cards |
| Preto | `#000000` | Fundo / vinheta |

- Texto sobre verde: sempre **Azul Petróleo** (branco sobre verde não tem contraste).
- Verde é destaque, não fundo de cena inteira.

### Tipografia

- Títulos: **Inter Display Black**, caixa alta, tracking negativo.
- Apoio: **Inter** SemiBold/Bold.

## Padrão de edição (da referência)

- Corte a cada ~6 s em média; inserts de 2–4 s sempre que um conceito concreto é citado.
- Quatro tipos de tela: A-roll com textos laterais · animação médica com o médico em
  círculo (PiP) · B-roll com título grande em caixa alta · tela dividida para comparações.
- Toda afirmação numérica entra com **card de estudo** (fonte completa + trecho destacado).
- Roteiro: gancho (0–20 s) → apresentação + promessa → mecanismo → prático (dose exata)
  → como medir/acompanhar → resumo → CTA + próximo vídeo.
- Thumbnail: fundo escuro, médico à direita, palavra-chave em caixa de destaque,
  título branco caixa alta, elemento gráfico (ECG/anatomia) à esquerda.

## Estrutura

```
assets/      foto, logo original, logo verde/branco, símbolo, wordmark
templates/   thumbnail.html (1280×720) · motion-card-estudo.html (1920×1080, 10 s)
tools/       screenshot.js (HTML → PNG) · render-video.js (HTML animado → frames)
exemplos/    renders aprovados como referência
```

## Como renderizar

Requer Node + Playwright (Chromium) e ffmpeg.

```bash
cd video-kit/templates
# Thumbnail
NODE_PATH=$(npm root -g) node ../tools/screenshot.js thumbnail.html thumb.png 1280 720
# Motion (10 s a 30 fps)
mkdir -p frames
NODE_PATH=$(npm root -g) node ../tools/render-video.js motion-card-estudo.html frames 10 30
ffmpeg -framerate 30 -i frames/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 motion.mp4
```

As animações são CSS com `animation-delay` em segundos absolutos; o render pausa todas as
animações e avança `currentTime` quadro a quadro.

## Pendências

- O estudo citado no exemplo (Mandsager et al., JAMA Netw Open 2018;1(6):e183605) foi
  citado de memória: conferir números no artigo antes de publicar.
- Melhorar com: gravação real (A-roll), foto com fundo removido, animações 3D (com aprovação de custo).
