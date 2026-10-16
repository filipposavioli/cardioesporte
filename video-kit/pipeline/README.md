# Pipeline de edição (YouTube, vídeo com o médico falando para a câmera)

Usado na amostra "Zona 2" (IMG_8005.MOV, 4K, 10:50 → amostra de 3:32).
Rodar todos os passos na pasta de trabalho onde estão `raw.mov`, `simbolo.png` e `wordmark.png`.

| Passo | Script | O que faz |
|---|---|---|
| 1 | `transcrever.py medium` | Whisper (faster-whisper) em `audio.wav` (16 kHz mono) → `transcript.json` com tempo por palavra |
| 2 | `edl.py` | Remove pausas > 0,4 s e tropeços (`EXCLUDE`), define enquadramentos por trecho (`PLAN`: WIDE/MED/CLOSE/LEFT/PIP) e alterna jump cuts → `clips.json` |
| 3 | `base.py` | Corta cada clipe do 4K com crop + escala 1080p 30 fps, contagem exata de quadros → `base/` → concat em `base.mov` |
| 4 | `gen_overlay.py` | Gera `overlay.html` com todos os gráficos já no tempo editado (`IV` = intervalos em tempo-fonte) |
| 5 | `render_ov.js` | Renderiza cada gráfico com fundo transparente (Playwright) → `ov/<nome>/` → `ffmpeg -c:v qtrle` → `ov_<nome>.mov` |
| 6 | `srt.py` | Legendas SRT no tempo editado, com correções de nomes |
| 7 | `compose.py` | Sobrepõe os gráficos, trata o áudio (passa-alta, redução de ruído, compressor, −14 LUFS), adiciona `endcard.html` → MP4 final |

Correção de cor em `grade.txt` (aplicada em `base.py`): menos amarelo na parede, pele mais neutra, vinheta leve.
`GAPS` em `edl.py` insere pausas de 1,6 s nas telas de capítulo.
Preferência do Dr. Filippo: diagramas em painel lateral com ele em cena, sem tela cheia com círculo (PiP).

Enquadramentos: o crop `LEFT` deixa o médico em ~36% da largura, liberando a direita para painéis;
`PIP` posiciona o rosto dentro do círculo do gráfico em tela cheia (círculo em 310,280, raio 250).

Os tempos dos gráficos são escritos em tempo-fonte (segundos do arquivo bruto) e convertidos por `to_out()`,
então mudar cortes em `edl.py` não desalinha os gráficos.
