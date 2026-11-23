# GTA 6ix graphics assets

The street materials and sky are local copies of [CC0 assets from Poly Haven](https://polyhaven.com/license). The game uses resized texture maps and loads them from its own static files.

- [Asphalt 01](https://polyhaven.com/a/asphalt_01)
- [Pavement 02](https://polyhaven.com/a/pavement_02)
- [Brown Planks 09](https://polyhaven.com/a/brown_planks_09)
- [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock)
- [Bark Brown 02](https://polyhaven.com/a/bark_brown_02)
- [Evening Road 01 (Pure Sky)](https://polyhaven.com/a/evening_road_01_puresky)
- [Industrial Sunset (Pure Sky)](https://polyhaven.com/a/industrial_sunset_puresky)
- [Concrete Pavement 02](https://polyhaven.com/a/concrete_pavement_02)

The courier and pedestrian rigs use [Casual Walker by tevy](https://tevy.dev/models/casual-walker), CC0 1.0.

The Toronto landmarks and train are original game meshes. Visual references include the [CN Tower design brief](https://www.cntower.ca/media/2226/download), [Rogers Centre history](https://www.mlb.com/bluejays/ballpark/information/history), and [Metrolinx’s Union Station materials](https://www.metrolinx.com/en/projects-and-programs/union-station).

## Optional recorded audio

Put recordings in `public/audio/` and map the matching keys in `public/audio/pack.json` to their filenames. Unmapped sounds use the built-in synthesis. WAV and MP3 are supported, and WAV is preferable for tight loops.

| Key | Recording |
| --- | --- |
| `city` | 30–60 seconds of downtown traffic and distant street activity |
| `waterfront` | 30–60 seconds of light waves and wind |
| `engineIdle`, `engineRev` | Separate 5–10 second steady idle and steady medium/high rev loops from the same car |
| `tireRoll`, `tireSqueal` | 3–8 seconds each of steady asphalt tire noise and a sustained skid |
| `impactSoft`, `impactHard` | Separate bumper tap and heavier impact one-shots |
| `passingCar`, `streetcarRoll`, `goTrainRoll` | Steady rolling sections for the spatial traffic mix |
| `streetcarBell`, `doorClose` | Short one-shots |
| `fixtureBreak` | A short, subdued metal clack for struck street fixtures |
