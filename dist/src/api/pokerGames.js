"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pokerGame_1 = require("../controllers/pokerGame");
const router = express_1.Router({ mergeParams: true });
router.post('/game/call', pokerGame_1.call);
router.post('/game/openLobby', pokerGame_1.openLobby);
router.post('/game/newPlayer', pokerGame_1.newPlayer);
router.post('/game/kickPlayer', pokerGame_1.kickPlayer);
router.post('/game/fetchPlayers', pokerGame_1.fetchPlayers);
router.post('/game/fold', pokerGame_1.fold);
router.post('/game/closeLobby', pokerGame_1.closeLobby);
router.post('/game/fetchGames', pokerGame_1.fetchGames);
exports.default = router;
