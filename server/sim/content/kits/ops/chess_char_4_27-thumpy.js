// server/sim/content/kits/ops/chess_char_4_27-thumpy.js — 珊比 T4 商店棋的正式棋子 kit；技能实现与原始 operator kit 共用。
//
// 珊比 (char_4235_thumpy) was a 自选 (DIY) 6★ of the tier-5 / tier-6 slots; the maintainer promoted her to a visible T4
// shop chess of the 元素 bond (tools/content/custom.mjs `elementChess`, docs/research/17-element-bond.md §3). Her kit is
// unchanged and stays the single implementation in op-thumpy.js — one implementation serving every chess record of the
// operator, the 克莱门莎 (chess_char_5_clemnt) / 巴别塔 pattern (kits/README.md, test/content/kits_layout.test.js
// SHARED_IMPL). See that file for the kit contract and the fidelity notes of every skill, talent and module.
//
// A PRESET chess resolves its kit by baseChessId (`chess_char_4_27_a`), so the shim's single key is that id, and the
// elite (`_b`) shares it. The kit reads its numbers from the chess record like any other, so the tier-4 elite's module
// stage (equipLevel 0 — see the chess row) is what it sees.
import op from './op-thumpy.js';

export default { chess_char_4_27_a: op.char_4235_thumpy };
