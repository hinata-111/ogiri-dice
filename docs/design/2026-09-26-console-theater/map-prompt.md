# Background asset generation

Built-in image_gen, style-transfer. Source: app/public/art/tokyo-board.png; approved reference: approved-reference.png. Result: app/public/art/tokyo-board-console.png. Original asset retained.

Use case: style-transfer.
Asset type: production background map for a playable Japanese comedy board game, landscape 16:9.
Input 1 is the EDIT TARGET, the current Tokyo city map. Input 2 is the approved STYLE REFERENCE of a console board game with interface.
Create ONLY the underlying city map background, NOT a game screenshot and NOT any UI. Preserve exactly input 1's camera framing, placement of major landmarks, city blocks, road centerlines, waterways and bridges, so existing interactive board node coordinates still align. In particular Tokyo Tower stays at 52% horizontal and 62% vertical, temple northeast, river along right edge bending below, skyscraper cluster center-left, waterfront island lower right. This positional preservation is critical.
Restyle input 1 to the restrained matte polygonal console game environment seen behind the card in input 2. Simple clean modeled buildings, flat surfaces, 2-3 tones per building, small regular windows, restrained sage foliage, soft blue water, warm grey roads. Reduce tiny trees and decorative clutter by half, remove blossoms and tiny pedestrians. Keep wide readable open road network and intentional uncluttered spaces for real game tiles. Strong tidy geometry, consistent perspective and neutral daylight. Tokyo local theater is the theme; a few small quiet red awnings are fine, do not add labels.
Avoid painterly brush texture, photographic detail, bloom, glitter, haze, saturated party colors, glossy toy surfaces, blur, depth of field, confetti, human faces, people, trains. Replace explicit railway tracks in lower center with a broad neutral avenue along the same path. NO overlaid cards, text, logos, board squares, routes, numbered game tokens or HUD; all those are rendered separately in the real game.
Output one full bleed clean 16:9 city background with the exact same geography as input 1.
