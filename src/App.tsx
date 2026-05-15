import React, { useEffect, useMemo, useRef, useState } from "react";
import { Trophy, Clock, Car, ListChecks, BarChart3, Flag, RotateCcw, Wifi, WifiOff, RefreshCcw, Timer, Search, Image as ImageIcon, ExternalLink, Star, AlertTriangle, Plus, Trash2, Activity, ChevronDown, ChevronUp, UserRound, ShieldCheck, LogOut, LockKeyhole } from "lucide-react";

const STORAGE_KEY = "nurburgring-2026-companion-v6-race-watch";
const AUTH_TOKEN_KEY = "nurburgring-2026-companion-auth-token";
const API_BASE_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const ADMIN_SESSION_KEY = "nurburgring-2026-companion-admin-session";
const ADMIN_PASSWORD = "ring2026";
const RACE_START_BRT = "2026-05-16T10:00:00-03:00";
const RACE_END_BRT = "2026-05-17T10:00:00-03:00";
const QUALIFYING_FREEZE_BRT = "2026-05-15T10:00:00-03:00";


type QRow = { pos?: number; num: string; team: string; car: string; time: string; cls: string; change?: number; pitStops?: string; pitState?: string; lastLap?: string };
type GridCar = { num: string; cls: string; team: string; car: string; why: string; group: string; photo: string };
type Phase = { phase: string; leader: string; surprise: string; note: string };
type DriverCard = { name: string; nationality: string; carNum: string; team: string; car: string; role: string; won24h: string; history: string; watch: string; avatar?: string };
type DriverTeamGroup = { key: string; car: GridCar; drivers: DriverCard[] };
type RaceEvent = { id: number; time: string; title: string; note: string; tag: string };
type RaceControlMessage = {
  time: string;
  carNum: string;
  message: string;
  translatedMessage: string;
  type: "penalty" | "investigation" | "technical" | "code60" | "gps" | "no-action" | "info";
  raw: unknown;
};
type RaceControlRawMessage = Record<string, unknown> | string;
type AppUser = { id: string; email: string; displayName?: string };
type RaceControlGroup = {
  num: string;
  messages: RaceControlMessage[];
  latest: RaceControlMessage;
  car?: GridCar;
  live?: QRow & { pos?: number };
  tone: string;
  urgent: boolean;
  firstIndex: number;
};

const q1Seed: QRow[] = [
  { pos: 1, num: "#80", team: "Mercedes-AMG Team RAVENOL", car: "Mercedes-AMG GT3", time: "8:14.957", cls: "SP9" },
  { pos: 2, num: "#1", team: "ROWE Racing", car: "BMW M4 GT3 EVO", time: "8:18.069", cls: "SP9" },
  { pos: 3, num: "#3", team: "Mercedes-AMG Team Verstappen Racing", car: "Mercedes-AMG GT3", time: "8:18.539", cls: "SP9" },
  { pos: 4, num: "#99", team: "ROWE Racing", car: "BMW M4 GT3 EVO", time: "8:18.602", cls: "SP9" },
  { pos: 5, num: "#911", team: "Manthey Racing", car: "Porsche 911 GT3 R", time: "8:21.717", cls: "SP9" },
  { pos: 6, num: "#130", team: "Red Bull Team ABT", car: "Lamborghini Huracan GT3 EVO2", time: "8:21.998", cls: "SP9" },
  { pos: 7, num: "#77", team: "Schubert Motorsport", car: "BMW M4 GT3 EVO", time: "8:26.625", cls: "SP9" },
  { pos: 8, num: "#64", team: "HRT Ford Racing", car: "Ford Mustang GT3", time: "8:26.751", cls: "SP9" },
  { pos: 9, num: "#16", team: "Scherer Sport PHX", car: "Audi R8 LMS GT3 evo II", time: "8:27.080", cls: "SP9" },
  { pos: 10, num: "#17", team: "Dunlop Motorsport", car: "Porsche 911 GT3 R", time: "8:27.176", cls: "SP9" }
];

const agenda = [
  { day: "Qui 14/05", br: "08:10", item: "Qualifying 1", tag: "Q1", iso: "2026-05-14T08:10:00-03:00", durationMin: 125 },
  { day: "Qui 14/05", br: "14:55", item: "Qualifying 2", tag: "Q2", iso: "2026-05-14T14:55:00-03:00", durationMin: 215 },
  { day: "Sex 15/05", br: "03:45", item: "Top Qualifying 1", tag: "Top Q1", iso: "2026-05-15T03:45:00-03:00", durationMin: 30 },
  { day: "Sex 15/05", br: "04:40", item: "Top Qualifying 2", tag: "Top Q2", iso: "2026-05-15T04:40:00-03:00", durationMin: 30 },
  { day: "Sex 15/05", br: "05:30", item: "Qualifying 3", tag: "Q3", iso: "2026-05-15T05:30:00-03:00", durationMin: 65 },
  { day: "Sex 15/05", br: "08:30", item: "Top Qualifying 3", tag: "Top Q3", iso: "2026-05-15T08:30:00-03:00", durationMin: 60 },
  { day: "Sáb 16/05", br: "05:00", item: "Warm-up", tag: "Pré", iso: "2026-05-16T05:00:00-03:00", durationMin: 60 },
  { day: "Sáb 16/05", br: "09:40", item: "Volta de formação", tag: "Grid", iso: "2026-05-16T09:40:00-03:00", durationMin: 20 },
  { day: "Sáb 16/05", br: "10:00", item: "Largada das 24h", tag: "Corrida", iso: RACE_START_BRT, durationMin: 1440 },
  { day: "Dom 17/05", br: "10:00", item: "Chegada", tag: "Final", iso: RACE_END_BRT, durationMin: 30 }
];

function getAgendaStatus(a: (typeof agenda)[number], timestamp: number) {
  const start = new Date(a.iso).getTime();
  const end = start + a.durationMin * 60 * 1000;
  if (timestamp < start) return "Depois";
  if (timestamp >= start && timestamp < end) return "Agora";
  return "Concluído";
}

function agendaTone(status: string) {
  if (status === "Concluído") return "green";
  if (status === "Agora") return "red";
  return "gray";
}

function agendaCardClass(status: string) {
  if (status === "Concluído") return "border-emerald-300 bg-emerald-50";
  if (status === "Agora") return "border-red-300 bg-red-50 ring-2 ring-red-100";
  return "border-zinc-100 bg-zinc-50";
}

const references = [
  { year: 2026, session: "Q1", p1: "#80 Mercedes-AMG", best: "8:14.957", p10: "8:27.176", window: "+12.219s", note: "Sessão inicial" },
  { year: 2025, session: "Top Qualifying", p1: "#911 Manthey Porsche", best: "8:12.741", p10: "8:19.396", window: "+6.655s", note: "Referência recente" },
  { year: 2024, session: "Top Q", p1: "#72 BMW M Team RMG", best: "8:10.992", p10: "8:13.692", window: "+2.700s", note: "Top 10 compacto" },
  { year: 2023, session: "Top Q", p1: "#4 Mercedes-AMG", best: "8:09.058", p10: "8:11.824", window: "+2.766s", note: "Ano muito rápido" }
];

const gridRaw = [
"#1|SP 9 PRO (IGTC)|ROWE RACING|BMW M4 GT3 EVO",
"#3|SP 9 PRO (IGTC)|Mercedes-AMG Team Verstappen Racing|Mercedes-AMG GT3",
"#7|SP 9 PRO (IGTC)|Konrad Motorsport|Lamborghini Huracan GT3 EVO2",
"#16|SP 9 PRO|Scherer Sport PHX|Audi R8 LMS GT3 evo II",
"#17|SP 9 PRO (IGTC)|Dunlop Motorsport|Porsche 911 GT3 R (992) Evo26",
"#24|SP 9 PRO (IGTC)|Lionspeed GP|Porsche 911 GT3 R (992) Evo26",
"#26|SP 9 PRO (IGTC)|PROsport racing|Mercedes-AMG GT3",
"#34|SP 9 PRO|Walkenhorst Motorsport|Aston Martin Vantage AMR GT3 EVO",
"#44|SP 9 PRO (IGTC)|Falken Motorsports|Porsche 911 GT3 R (992) Evo26",
"#45|SP 9 PRO (IGTC)|REALIZE KONDO RACING with Rinaldi|Ferrari 296 GT3 Evo26",
"#47|SP 9 PRO (IGTC)|KCMG|Mercedes-AMG GT3",
"#54|SP 9 PRO (IGTC)|Dinamic GT|Porsche 911 GT3 R (992) Evo26",
"#55|SP 9 PRO (IGTC)|Dinamic GT|Porsche 911 GT3 R (992) Evo26",
"#64|SP 9 PRO (IGTC)|HRT Ford Racing|Ford Mustang GT3",
"#67|SP 9 PRO (IGTC)|HRT Ford Racing|Ford Mustang GT3 EVO 2026",
"#69|SP 9 PRO|Doerr Motorsport|McLaren 720S GT3",
"#77|SP 9 PRO (IGTC)|Schubert Motorsport|BMW M4 GT3 EVO",
"#80|SP 9 PRO (IGTC)|Mercedes-AMG Team RAVENOL|Mercedes-AMG GT3",
"#84|SP 9 PRO|Red Bull Team ABT|Lamborghini Huracan GT3 EVO2",
"#99|SP 9 PRO (IGTC)|ROWE RACING|BMW M4 GT3 EVO",
"#130|SP 9 PRO|Red Bull Team ABT|Lamborghini Huracan GT3 EVO2",
"#911|SP 9 PRO (IGTC)|Manthey|Porsche 911 GT3 R (992) Evo26",
"#4|SP 9 PRO-AM (IGTC)|Goroyan RT by Car Collection|Porsche 911 GT3 R (992) Evo26",
"#11|SP 9 PRO-AM (IGTC)|SR Motorsport by Schnitzelalm|Mercedes-AMG GT3",
"#18|SP 9 PRO-AM (IGTC)|Lionspeed GP|Porsche 911 GT3 R (992) Evo26",
"#30|SP 9 PRO-AM (IGTC)|Hankook Competition|Porsche 911 GT3 R (992) Evo26",
"#32|SP 9 PRO-AM (IGTC)|Toyo Tires with Ring Racing|Mercedes-AMG GT3",
"#33|SP 9 PRO-AM|KKrämer Racing|Audi R8 LMS GT3 evo II",
"#35|SP 9 PRO-AM|Walkenhorst Motorsport|Aston Martin Vantage AMR GT3 EVO",
"#39|SP 9 PRO-AM|Walkenhorst Motorsport|Aston Martin Vantage AMR GT3 EVO",
"#48|SP 9 PRO-AM (IGTC)|48 LOSCH Motorsport by BLACK FALCON|Porsche 911 GT3 R (992) Evo26",
"#65|SP 9 PRO-AM (IGTC)|HRT Ford Racing|Ford Mustang GT3 EVO 2026",
"#71|SP 9 PRO-AM|JUTA Racing|Audi R8 LMS GT3 evo II",
"#86|SP 9 PRO-AM (IGTC)|High Class Racing|Porsche 911 GT3 R (992) Evo26",
"#123|SP 9 PRO-AM (IGTC)|Mühlner Motorsport powered by H&R|Porsche 911 GT3 R (992) Evo26",
"#5|SP 9 AM (IGTC)|BLACK FALCON Team EAE|Porsche 911 GT3 R (992) Evo26",
"#8|SP 9 AM|JUTA Racing|Audi R8 LMS GT3 evo II",
"#36|SP 9 AM|Saugmotoren Motorsport / 3M|BMW E89 Z4",
"#37|SP 9 AM|PROsport racing|Aston Martin Vantage AMR GT3",
"#40|SP 9 AM|W.I.S Racing Team|BMW E89 Z4",
"#786|SP 9 AM|Renazzo Motorsport|Lamborghini Huracan GT3 EVO2",
"#10|SP 3T (AT)|Max Kruse Racing|VW Golf GTI Clubsport 24h",
"#13|Cup 2 AM|White Angel for Fly and Help|Porsche 911 GT3 Cup (992)",
"#777|Cup 2 AM|RPM Racing|Porsche 911 GT3 Cup (992)",
"#904|Cup 2 AM|Mühlner Motorsport powered by H&R|Porsche 911 GT3 Cup (992)",
"#908|Cup 2 AM|Hofor Racing|Porsche 911 GT3 Cup (992)",
"#909|Cup 2 AM|KKrämer Racing|Porsche 911 GT3 Cup (992)",
"#19|AT1 (AT)|Max Kruse Racing|Audi R8 LMS GT3 evo II",
"#75|AT1 (AT)|Max Kruse Racing|Audi R8 LMS GT3 evo II",
"#50|SP 4T (AT)|Max Kruse Racing|VW Golf GTI Clubsport 24h",
"#76|SP 4T (AT)|Max Kruse Racing|VW Golf GTI Clubsport 24h",
"#59|SP 8T|Doerr Motorsport|McLaren Artura Trophy Evo",
"#61|SP-X PRO|HWA Engineering Speed|HWA Evo R",
"#62|SP-X PRO|HWA Engineering Speed|HWA Evo R",
"#63|SP-X PRO|HWA Engineering Speed|HWA Evo R",
"#81|SP-X PRO|BMW M Motorsport|BMW M3 Touring 24h",
"#66|SP-X PRO-AM|Reiter Engineering|KTM X-Bow GTX",
"#82|SP 7|OVERTAKERACING x tm-racing.org|Porsche 718 Cayman GT4 Clubsport",
"#91|SP 7|Reiter Engineering|Porsche 911 GT3 Cup (991)",
"#88|SP 4T|SUBARU TECNICA INTERNATIONAL|Subaru WRX",
"#302|SP 4T|Hyundai Motorsport N|Hyundai Elantra N1 RP",
"#303|SP 4T|Hyundai Motorsport N|Hyundai Elantra N1 RP",
"#89|TCR|KMA-Racing|VW GOLF 7 GTI TCR DSG",
"#577|TCR|asBest Racing|Cupra Leon Competición TCR",
"#776|TCR|sharky-racing.com|Audi RS3 LMS SEQ",
"#830|TCR|Hyundai Motorsport N|Hyundai Elantra N TCR",
"#90|SP 10 PRO-AM (AT)|Teichmann Racing|Toyota GR Supra GT4 EVO2",
"#95|Cup 2 PRO|Sante Royal Racing Team|Porsche 911 GT3 Cup (992)",
"#900|Cup 2 PRO|BLACK FALCON Team Zimmermann|Porsche 911 GT3 Cup (992)",
"#902|Cup 2 PRO|Team LIQUI MOLY by BLACK FALCON|Porsche 911 GT3 Cup (992)",
"#918|Cup 2 PRO|Mühlner Motorsport powered by H&R|Porsche 911 GT3 Cup (992)",
"#919|Cup 2 PRO|Clickversicherung.de TEAM|Porsche 911 GT3 Cup (992)",
"#925|Cup 2 PRO|Huber Motorsport|Porsche 911 GT3 Cup (992)",
"#100|BMW 325i|Pistorius by EiFelkind Racing|BMW 325i",
"#101|BMW 325i|EiFelkind Racing|BMW 325i E90",
"#108|BMW 325i|asBest Racing|BMW 325i E90",
"#112|BMW 325i|JS Competition|BMW 325i E90",
"#109|SP 2T|TOYOTA GAZOO ROOKIE Racing|Toyota GR Yaris",
"#110|SP 2T|TOYOTA GAZOO ROOKIE Racing|Toyota GR Yaris",
"#380|SP 2T|BITTER|Opel Corsa GS Line 130",
"#145|SP 10 PRO-AM|Riller & Schnauck powered by Cerny Motorsport|BMW M4 GT4 EVO",
"#164|SP 10 PRO-AM|W&S Motorsport|Porsche 718 Cayman GT4 RS CS",
"#176|SP 10 PRO-AM|PROsport racing|Mercedes-AMG GT4",
"#177|SP 10 PRO-AM|AV Racing by BLACK FALCON|BMW M4 GT4 EVO",
"#187|SP 10 PRO-AM|FK Performance Motorsport|BMW M4 GT4",
"#888|SP 10 PRO-AM|Hofor Racing by Bonk Motorsport|BMW M4 GT4 EVO",
"#146|AT2 (AT)|GITI TIRE MOTORSPORT BY WS RACING|Porsche 911 GT3 Cup",
"#320|AT2 (AT)|Four Motors Bioconcept-Car|Porsche 911 GT3 Cup",
"#632|AT2 (AT)|BLACK FALCON Team FANATEC|Porsche 911 GT3 Cup",
"#152|SP 4|Oepen Motors Automobilsport|BMW 325CI",
"#169|SP 10 AM|Doerr Motorsport|Aston Martin Vantage AMR GT4",
"#171|SP 10 AM|BSL Racing Team|Porsche 718 Cayman GT4 RS CS",
"#175|SP 10 AM|PROsport racing|Mercedes-AMG GT4",
"#180|SP 10 AM|AV Racing by BLACK FALCON|BMW M4 GT4 EVO",
"#189|SP 10 AM|Hofor Racing by Bonk Motorsport|BMW M4 GT4 EVO",
"#170|SP 10|Toyo Tires with Ring Racing|Toyota GR Supra GT4 EVO2",
"#195|BMW M240i|Adrenalin Motorsport Team Mainhattan Wheels|BMW M240i Racing Cup",
"#651|BMW M240i|Adrenalin Motorsport Team Mainhattan Wheels|BMW M240i Racing Cup",
"#652|BMW M240i|Adrenalin Motorsport Team Mainhattan Wheels|BMW M240i Racing Cup",
"#653|BMW M240i|Adrenalin Motorsport Team Mainhattan Wheels|BMW M240i Racing Cup",
"#658|BMW M240i|JJ Motorsport|BMW M240i Racing Cup",
"#665|BMW M240i|GITI TIRE MOTORSPORT BY WS RACING|BMW M240i Racing Cup",
"#667|BMW M240i|Breakell Racing|BMW M240i Racing Cup",
"#669|BMW M240i|Keeevin Motorsport GmbH|BMW M240i Racing Cup",
"#670|BMW M240i|GITI TIRE MOTORSPORT BY WS RACING|BMW M240i Racing Cup",
"#677|BMW M240i|asBest Racing|BMW M240i Racing Cup",
"#277|SP 3|RAVENOL Motorsport by MDM Racing|BMW 318ti E36",
"#300|SP 3T|Ollis Garage Racing|Dacia Logan",
"#317|SP 3T|2R Racing|Audi TTs",
"#321|SP 3T|sharky-racing.com|VW Golf 7 GTI TCR DSG",
"#800|SP 3T|asBest Racing|VW Golf 7 GTI TCR DSG",
"#808|SP 3T|asBest Racing|Cupra TCR DSG",
"#821|SP 3T|sharky-racing.com|Audi RS3 LMS DSG",
"#396|V6|Adrenalin Motorsport Team Mainhattan Wheels|Porsche Cayman S",
"#410|V6|rent2Drive-MEHRTEC-racing|Porsche Cayman GTS",
"#415|V6|Köppen Motorsport|Porsche 911 Carrera",
"#418|V6|SRS Team Sorg Rennsport|Porsche Cayman S",
"#448|V6|OVERTAKERACING x tm-racing.org|Porsche Cayman S",
"#420|SP 7 (AT)|Four Motors Bioconcept-Car|Porsche 718 Cayman GT4 Clubsport",
"#440|V5|QTQ-Raceperformance|Porsche Cayman CM12",
"#444|V5|Adrenalin Motorsport Team Mainhattan Wheels|Porsche Cayman CM12",
"#445|V5|rent2Drive-MEHRTEC-racing|Porsche Cayman CM12",
"#454|V5|Pure Racing by Mohr Motorsportservice|Porsche Cayman CM12",
"#455|V5|Pure Racing by Mohr Motorsportservice|Porsche Cayman CM12",
"#471|VT2 Front|Jung Motorsport|Cupra Leon KL",
"#472|VT2 Front|Jung Motorsport|Cupra Leon KL",
"#474|VT2 Front|Time Attack Paderborn by GTÜ Wieseler|VW Golf",
"#477|VT2 Front|asBest Racing|VW Scirocco R TSI",
"#480|VT2 Front|Dupré Motorsport Engineering|Audi S3-Lim",
"#500|VT2 Heck|Adrenalin Motorsport Team Mainhattan Wheels|BMW 330i",
"#501|VT2 Heck|Adrenalin Motorsport Team Mainhattan Wheels|BMW 330i",
"#503|VT2 Heck|GITI TIRE MOTORSPORT BY WS RACING|Toyota Supra",
"#505|VT2 Heck|Keeevin Motorsport GmbH|BMW 330i",
"#514|VT2 Heck|SRS Team Sorg Rennsport|BMW 330i",
"#519|VT2 Heck|RAVENOL Japan|Toyota Supra",
"#520|VT2 Heck|Toyo Tires with Ring Racing|Toyota Supra",
"#524|VT2 Heck|SRS Team Sorg Rennsport|Toyota Supra",
"#569|VT2 Heck|NFR motorsports|BMW 330i",
"#650|BMW M240i|Adrenalin Motorsport Team Mainhattan Wheels|BMW M240i Racing Cup",
"#870|BMW|Adrenalin Motorsport Team Mainhattan Wheels|BMW M2 Racing G87",
"#878|BMW|SRS Team Sorg Rennsport|BMW M2 Racing G87",
"#898|BMW|Walkenhorst Motorsport|BMW M2 Racing G87",
"#899|BMW|W&S Motorsport|BMW M2 CS Racing Cup",
"#939|Cup 3 AM|BLACK FALCON Team Zimmermann|Porsche 718 Cayman GT4 Clubsport",
"#945|Cup 3 AM|Renazzo Motorsport|Porsche 718 Cayman GT4 Clubsport",
"#949|Cup 3 AM|SRS Team Sorg Rennsport|Porsche 718 Cayman GT4 Clubsport",
"#952|Cup 3 AM|Smyrlis Racing|Porsche 718 Cayman GT4 Clubsport",
"#969|Cup 3 AM|SRS Team Sorg Rennsport|Porsche 718 Cayman GT4 Clubsport",
"#977|Cup 3 AM|BSL Racing Team|Porsche 718 Cayman GT4 Clubsport",
"#978|Cup 3 AM|KKrämer Racing|Porsche 718 Cayman GT4 Clubsport",
"#982|Cup 3 AM|W&S Motorsport|Porsche 718 Cayman GT4 Clubsport",
"#941|Cup 3 PRO|Adrenalin Motorsport Team Mainhattan Wheels|Porsche 718 Cayman GT4 Clubsport",
"#959|Cup 3 PRO|SRS Team Sorg Rennsport|Porsche 718 Cayman GT4 Clubsport",
"#961|Cup 3 PRO|W&S Motorsport|Porsche 718 Cayman GT4 Clubsport",
"#962|Cup 3 PRO|W&S Motorsport|Porsche 718 Cayman GT4 Clubsport",
"#966|Cup 3 PRO|asBest Racing|Porsche 718 Cayman GT4 Clubsport",
"#967|Cup 3 PRO|Breakell Racing|Porsche 718 Cayman GT4 Clubsport",
"#971|Cup 3 PRO|Speedworxx Automotive|Porsche 718 Cayman GT4 Clubsport",
"#979|Cup 3 PRO|SRS Team Sorg Rennsport|Porsche 718 Cayman GT4 Clubsport",
"#999|Cup 3 PRO|Mühlner Motorsport powered by H&R|Porsche 718 Cayman GT4 RS CS",
"#992|SP-PRO PRO-AM(AT)|Manthey Team eFuel Griesemann|Porsche 911 GT3 CUP MR"
];

const carNotes: Record<string, [string, string]> = {
  "#80": ["Favorito", "Melhor tempo na Q1; referência imediata para a pole provisória."],
  "#1": ["Favorito", "BMW da ROWE, lineup pesado e ritmo de ponta."],
  "#3": ["Favorito", "Carro do Verstappen Racing; nome grande e potencial de volta limpa."],
  "#99": ["Favorito", "Segundo BMW da ROWE para comparar estratégia e ritmo."],
  "#911": ["Favorito", "Manthey Porsche: favorito histórico no Ring."],
  "#130": ["Favorito", "Lamborghini Red Bull/ABT no bolo da frente."],
  "#77": ["Favorito", "Schubert BMW costuma crescer durante o fim de semana."],
  "#64": ["Surpresa", "Mustang GT3 forte para medir evolução da Ford no Ring."],
  "#67": ["Surpresa", "Mustang GT3 EVO 2026; carro novo e chamativo."],
  "#16": ["Surpresa", "Audi sempre perigoso na Nordschleife."],
  "#17": ["Surpresa", "Porsche GT3 no top 10 inicial; pode entrar no jogo."],
  "#300": ["Personagem", "Dacia Logan: o personagem máximo do grid."],
  "#632": ["Personagem", "Jimmy Broadbent, Misha Charoudin e BLACK FALCON/FANATEC."],
  "#81": ["Personagem", "BMW M3 Touring 24h: projeto especial e visual diferente."],
  "#88": ["Personagem", "Subaru WRX no Ring sempre merece atenção."],
  "#109": ["Personagem", "Toyota GR Yaris pequeno, diferente e divertido de caçar."],
  "#110": ["Personagem", "Segundo GR Yaris para comparar com o #109."],
  "#10": ["Personagem", "Golf GTI Clubsport 24h; carro diferente e fácil de reconhecer."],
  "#61": ["Personagem", "HWA EVO R: protótipo/experimental e visual raro."],
  "#62": ["Personagem", "HWA EVO R: outro carro especial da HWA."],
  "#63": ["Personagem", "HWA EVO R com lineup forte; vale acompanhar."],
  "#19": ["Personagem", "Audi R8 em classe AT; interessante por estratégia e regras."],
  "#75": ["Personagem", "Outro Audi R8 AT da Max Kruse Racing."]
};

function classifyCar(num: string, cls: string): [string, string] {
  if (carNotes[num]) return carNotes[num];
  if (cls.includes("SP 9")) return ["GT3/SP9", "GT3/SP9: carro de ponta para acompanhar ritmo, tráfego e estratégia."];
  if (cls.includes("TCR")) return ["Turismo/TCR", "Carro de turismo; boa referência para tráfego entre classes."];
  if (cls.includes("Cup")) return ["Cup", "Disputa de monomarca/GT Cup dentro da corrida."];
  if (cls.includes("BMW") || cls.includes("M240i")) return ["BMW/Turismo", "Categoria numerosa; ótima para acompanhar brigas de classe."];
  if (cls.includes("VT2") || cls.includes("V5") || cls.includes("V6")) return ["Produção", "Carro mais próximo de turismo/produção; importante no tráfego."];
  if (cls.includes("SP-X") || cls.includes("SP-PRO")) return ["Especial", "Projeto especial ou classe técnica diferente do padrão."];
  if (cls.includes("AT")) return ["Alternativo", "Classe alternativa; vale observar pela diferença de ritmo e conceito."];
  return ["Grid", "Mais uma corrida dentro da corrida: acompanhe a disputa de classe."];
}

const carSeed: GridCar[] = gridRaw.map((line) => {
  const [num, cls, team, car] = line.split("|");
  const [group, why] = classifyCar(num, cls);
  return { num, cls, team, car, why, group, photo: `https://www.24h-rennen.de/wp-content/uploads/teilnehmer_26h/small/${num.replace("#", "")}.jpg` };
});

const phasesSeed: Phase[] = [
  { phase: "Largada", leader: "", surprise: "", note: "" },
  { phase: "3h", leader: "", surprise: "", note: "" },
  { phase: "6h", leader: "", surprise: "", note: "" },
  { phase: "Noite", leader: "", surprise: "", note: "" },
  { phase: "Madrugada", leader: "", surprise: "", note: "" },
  { phase: "Manhã", leader: "", surprise: "", note: "" },
  { phase: "Última hora", leader: "", surprise: "", note: "" },
  { phase: "Final", leader: "", surprise: "", note: "" }
];

const raceEventsSeed: RaceEvent[] = [
  { id: 1, time: "Pré-corrida", title: "Acompanhar favoritos", note: "#80, #3, #911, #1, #99, #64/#67 e #300 estão no radar.", tag: "Plano" },
  { id: 2, time: "Largada", title: "Olhar tráfego e incidentes", note: "Primeiras voltas no Ring costumam definir quem vai sobreviver limpo.", tag: "Atenção" }
];

const pilotsSeed: DriverCard[] = [
  { name: "Max Verstappen", nationality: "HOL", carNum: "#3", team: "Mercedes-AMG Team Verstappen Racing", car: "Mercedes-AMG GT3", role: "atração global", won24h: "Ainda não venceu as 24h de Nürburgring", history: "Nome mais chamativo do grid. Mesmo sem histórico longo na prova, chama atenção pelo nível absurdo de adaptação e pela expectativa em volta do projeto Verstappen Racing.", watch: "Ver como ele lida com tráfego, noite e ritmo constante na Nordschleife." },
  { name: "Maro Engel", nationality: "ALE", carNum: "#80", team: "Mercedes-AMG Team RAVENOL", car: "Mercedes-AMG GT3", role: "especialista Mercedes-AMG", won24h: "Já venceu as 24h de Nürburgring", history: "Um dos nomes mais fortes da Mercedes no GT3 moderno. Costuma ser referência em volta rápida, stint limpo e leitura de corrida longa.", watch: "Se o #80 estiver na briga de pole ou liderança, ele é um dos motivos." },
  { name: "Kevin Estre", nationality: "FRA", carNum: "#911", team: "Manthey", car: "Porsche 911 GT3 R", role: "referência Porsche/Manthey", won24h: "Já venceu as 24h de Nürburgring", history: "Muito ligado à história recente da Manthey no Ring. É agressivo, rápido e costuma aparecer em momentos decisivos.", watch: "Quando o #911 precisar atacar no tráfego, ele é um dos pilotos mais legais de acompanhar." },
  { name: "Thomas Preining", nationality: "AUT", carNum: "#911", team: "Manthey", car: "Porsche 911 GT3 R", role: "Porsche factory driver", won24h: "Ainda busca vitória geral nas 24h", history: "Piloto muito forte de Porsche, com ritmo alto em GT3 e experiência em disputas de ponta.", watch: "Boa referência para ver constância do Manthey durante stints longos." },
  { name: "Raffaele Marciello", nationality: "ITA/SUI", carNum: "#1", team: "ROWE RACING", car: "BMW M4 GT3 EVO", role: "GT3 elite", won24h: "Ainda busca vitória geral nas 24h", history: "Um dos pilotos GT3 mais fortes da geração. É conhecido por extrair muito em classificação e em stint de ataque.", watch: "Se aparecer em ar limpo, pode baixar tempo forte com o BMW." },
  { name: "Augusto Farfus", nationality: "BRA", carNum: "#1", team: "ROWE RACING", car: "BMW M4 GT3 EVO", role: "brasileiro / experiência BMW", won24h: "Nome muito experiente em endurance", history: "Piloto brasileiro extremamente experiente em turismo, GT e endurance. Tem longa relação com BMW Motorsport.", watch: "Legal acompanhar por ser brasileiro e por saber administrar corrida longa." },
  { name: "Kelvin van der Linde", nationality: "RSA", carNum: "#1", team: "ROWE RACING", car: "BMW M4 GT3 EVO", role: "especialista de Nürburgring", won24h: "Já venceu as 24h de Nürburgring", history: "Piloto muito forte no Ring, com reputação de ser rápido em GT3 e muito eficiente em tráfego.", watch: "Se chover ou virar corrida de sobrevivência, ele tende a crescer." },
  { name: "Dries Vanthoor", nationality: "BEL", carNum: "#99", team: "ROWE RACING", car: "BMW M4 GT3 EVO", role: "BMW factory driver", won24h: "Já venceu as 24h de Nürburgring", history: "Nome muito forte de GT e endurance. Costuma entregar ritmo alto e decisões agressivas quando precisa recuperar tempo.", watch: "Boa referência para comparar o #99 com o #1 da ROWE." },
  { name: "Sheldon van der Linde", nationality: "RSA", carNum: "#99", team: "ROWE RACING", car: "BMW M4 GT3 EVO", role: "BMW / DTM / GT3", won24h: "Ainda busca vitória geral nas 24h", history: "Piloto muito rápido ligado à BMW, com bagagem em DTM e GT3. Forte em ritmo puro.", watch: "Pode ser peça importante se o #99 entrar na briga direta contra Manthey e Mercedes." },
  { name: "Marco Wittmann", nationality: "ALE", carNum: "#77", team: "Schubert Motorsport", car: "BMW M4 GT3 EVO", role: "BMW / campeão DTM", won24h: "Ainda busca vitória geral nas 24h", history: "Piloto muito conhecido da BMW, com experiência de ponta em turismo e GT. Tende a ser seguro e rápido em corrida longa.", watch: "Se a Schubert aparecer, ele é um dos nomes para sustentar o ritmo." },
  { name: "Luca Stolz", nationality: "ALE", carNum: "#80", team: "Mercedes-AMG Team RAVENOL", car: "Mercedes-AMG GT3", role: "Mercedes-AMG / endurance", won24h: "Já venceu as 24h de Nürburgring", history: "Muito experiente de AMG GT3 e corridas longas. Costuma ser constante e rápido, sem chamar tanto holofote quanto merece.", watch: "Pode ser o piloto que mantém o #80 vivo quando a corrida vira estratégia." },
  { name: "Daniel Juncadella", nationality: "ESP", carNum: "#3", team: "Mercedes-AMG Team Verstappen Racing", car: "Mercedes-AMG GT3", role: "GT3 experiente", won24h: "Ainda busca vitória geral nas 24h", history: "Piloto rápido, experiente em Mercedes-AMG GT3 e acostumado com corrida de alto nível.", watch: "Importante para dar base técnica ao carro do Verstappen Racing." },
  { name: "Lucas Auer", nationality: "AUT", carNum: "#3", team: "Mercedes-AMG Team Verstappen Racing", car: "Mercedes-AMG GT3", role: "Mercedes-AMG / DTM", won24h: "Ainda busca vitória geral nas 24h", history: "Nome forte da Mercedes, com histórico em DTM e GT. Traz velocidade e experiência para o projeto.", watch: "Bom nome para observar em stints de ritmo constante." },
  { name: "Jules Gounon", nationality: "FRA/AND", carNum: "#3", team: "Mercedes-AMG Team Verstappen Racing", car: "Mercedes-AMG GT3", role: "GT3 elite", won24h: "Ainda busca vitória geral nas 24h", history: "Um dos grandes nomes de GT3 no mundo, muito forte em endurance e corridas com tráfego pesado.", watch: "Se o #3 virar candidato real, Gounon é uma das razões." },
  { name: "Christopher Mies", nationality: "ALE", carNum: "#64", team: "HRT Ford Racing", car: "Ford Mustang GT3", role: "experiência GT3", won24h: "Já venceu as 24h de Nürburgring", history: "Especialista em GT3 e no Ring. Agora é peça importante para entender o potencial do Mustang.", watch: "Se a Ford surpreender, ele provavelmente vai ter participação direta." },
  { name: "Frederic Vervisch", nationality: "BEL", carNum: "#64", team: "HRT Ford Racing", car: "Ford Mustang GT3", role: "rápido no Ring", won24h: "Já venceu as 24h de Nürburgring", history: "Tem grande bagagem em GT3 e costuma andar muito bem na Nordschleife.", watch: "Ótimo termômetro para o ritmo real do Mustang." },
  { name: "Frank Stippler", nationality: "ALE", carNum: "#67", team: "HRT Ford Racing", car: "Ford Mustang GT3 EVO 2026", role: "veterano do Ring", won24h: "Já venceu as 24h de Nürburgring", history: "Um dos pilotos mais respeitados da Nordschleife. Muito técnico, experiente e confiável em condições difíceis.", watch: "Perfeito para medir o Mustang novo em tráfego e trechos técnicos." },
  { name: "Timo Glock", nationality: "ALE", carNum: "#69 / #187", team: "Doerr Motorsport / FK Performance", car: "McLaren 720S GT3 / BMW M4 GT4", role: "nome famoso / ex-F1", won24h: "Ainda busca vitória geral nas 24h", history: "Ex-F1 e piloto muito conhecido do público. No Ring, chama atenção por ser nome grande em meio ao caos multiclasses.", watch: "Legal para seguir pelo nome e pela adaptação entre carros/projetos." },
  { name: "Misha Charoudin", nationality: "HOL/RUS", carNum: "#632", team: "BLACK FALCON Team FANATEC", car: "Porsche 911 GT3 Cup", role: "personagem do Ring", won24h: "Não venceu a geral das 24h", history: "Muito conhecido por conteúdo sobre Nürburgring e por viver o circuito de perto. É um personagem forte para quem acompanha internet e track days.", watch: "Vale acompanhar pelo lado humano e pela conexão com a cultura do Ring." },
  { name: "Jimmy Broadbent", nationality: "GBR", carNum: "#632", team: "BLACK FALCON Team FANATEC", car: "Porsche 911 GT3 Cup", role: "sim racing para corrida real", won24h: "Não venceu a geral das 24h", history: "Um dos nomes mais conhecidos da transição entre sim racing, conteúdo e automobilismo real.", watch: "História legal para acompanhar porque conecta o mundo virtual com a Nordschleife real." }
];

const tabs = [
  { id: "agora", label: "Agora", icon: Clock },
  { id: "racewatch", label: "Race Watch", icon: Activity },
  { id: "quali", label: "Qualifying", icon: Trophy },
  { id: "auto", label: "Config", icon: Wifi },
  { id: "live", label: "Live Timing", icon: Wifi },
  { id: "racecontrol", label: "Race Control", icon: Flag },
  { id: "carros", label: "Carros", icon: Car },
  { id: "pilotos", label: "Pilotos", icon: Flag },
  { id: "checklist", label: "Checklist", icon: ListChecks },
  { id: "placar", label: "Placar", icon: Flag },
  { id: "timeline", label: "Timeline", icon: AlertTriangle },
  { id: "refs", label: "Referências", icon: BarChart3 }
];

const tabGroups = [
  {
    title: "Ao vivo",
    tone: "red",
    tabs: tabs.filter((t) => ["agora", "racewatch", "live", "racecontrol"].includes(t.id))
  },
  {
    title: "Grid",
    tone: "dark",
    tabs: tabs.filter((t) => ["carros", "pilotos", "quali"].includes(t.id))
  },
  {
    title: "Anotações",
    tone: "amber",
    tabs: tabs.filter((t) => ["checklist", "placar", "timeline", "refs"].includes(t.id))
  },
  {
    title: "Sistema",
    tone: "gray",
    tabs: tabs.filter((t) => ["auto"].includes(t.id))
  }
];


const rosterSeed: { carNum: string; team: string; car: string; drivers: string[] }[] = [
  {
    "carNum": "#1",
    "team": "ROWE RACING",
    "car": "BMW M4 GT3 EVO",
    "drivers": [
      "Augusto Farfus",
      "Raffaele Marciello",
      "Jordan Pepper",
      "Kelvin van der Linde"
    ]
  },
  {
    "carNum": "#3",
    "team": "Mercedes-AMG Team Verstappen Racing",
    "car": "Mercedes-AMG GT3",
    "drivers": [
      "Max Verstappen",
      "Lucas Auer",
      "Jules Gounon",
      "Daniel Juncadella"
    ]
  },
  {
    "carNum": "#7",
    "team": "Franz Konrad",
    "car": "Lamborghini Huracan GT3",
    "drivers": [
      "Patricija Stalidzane",
      "Maximilian Paul",
      "Christian Engelhart",
      "Pavel Lefterov"
    ]
  },
  {
    "carNum": "#8",
    "team": "JUTA Racing",
    "car": "Audi R8 LMS GT3",
    "drivers": [
      "Alexey Veremenko",
      "SELV",
      "Elia Erhart"
    ]
  },
  {
    "carNum": "#11",
    "team": "Schnitzelalm Racing GmbH",
    "car": "Mercedes-AMG GT3",
    "drivers": [
      "Kenneth Heyer",
      "James Fittjel Jay Mo Hartling",
      "Philip Ellis"
    ]
  },
  {
    "carNum": "#16",
    "team": "ROWE RACING",
    "car": "BMW M4 GT3 EVO",
    "drivers": [
      "Christopher Haase",
      "Alexander Sims",
      "Ben Green"
    ]
  },
  {
    "carNum": "#17",
    "team": "Dunlop Motorsport",
    "car": "Audi R8 LMS GT3",
    "drivers": [
      "Julien Andlauer",
      "Dorian Boccolacci",
      "Nico Menzel",
      "Alessio Picariello"
    ]
  },
  {
    "carNum": "#24",
    "team": "Lionspeed GP",
    "car": "Porsche 911 GT3 R (992)",
    "drivers": [
      "Laurin Heinrich",
      "Laurens Vanthoor",
      "Ricardo Feller"
    ]
  },
  {
    "carNum": "#26",
    "team": "PROsport Racing",
    "car": "Mercedes-AMG GT3",
    "drivers": [
      "Adam Christodoulou",
      "Christopher Lulham",
      "Mikaël Grenier",
      "Marek Böckmann"
    ]
  },
  {
    "carNum": "#34",
    "team": "Walkenhorst Motorsport",
    "car": "Aston Martin Vantage AMR GT3",
    "drivers": [
      "Christian Krognes",
      "Mattia Drudi",
      "Nicki Thiim",
      "Felipe Fernandez Laser"
    ]
  },
  {
    "carNum": "#44",
    "team": "Falken Motorsports",
    "car": "Porsche 911 GT3 R (992)",
    "drivers": [
      "Klaus Bachler",
      "Tim Heinemann",
      "Sven Müller",
      "Morris Schuring"
    ]
  },
  {
    "carNum": "#45",
    "team": "REALIZE KONDO RACING",
    "car": "Ferrari 296 GT3",
    "drivers": [
      "David Perel",
      "Dennis Marschall",
      "Thierry Vermeulen",
      "Thomas Neubauer"
    ]
  },
  {
    "carNum": "#47",
    "team": "KCMG",
    "car": "Mercedes-AMG GT3",
    "drivers": [
      "Nirei Fukuzumi",
      "Naoya Gamou",
      "Jesse Krohn",
      "David Pittard"
    ]
  },
  {
    "carNum": "#54",
    "team": "Dinamic GT",
    "car": "Porsche 911 GT3 R (992)",
    "drivers": [
      "Bastian Buss",
      "Michael Klitgaard Christensen",
      "Joel Sturm",
      "Loek Hartog"
    ]
  },
  {
    "carNum": "#55",
    "team": "Dinamic GT",
    "car": "Porsche 911 GT3 R (992)",
    "drivers": [
      "Michele Beretta",
      "Alessandro Ghiretti",
      "Joel Sturm",
      "Loek Hartog"
    ]
  },
  {
    "carNum": "#64",
    "team": "HRT Ford Racing",
    "car": "Ford Mustang GT3",
    "drivers": [
      "Arjun Maini",
      "Fabio Scherer",
      "David Schumacher",
      "Frank Stippler"
    ]
  },
  {
    "carNum": "#65",
    "team": "HRT Ford Racing",
    "car": "Ford Mustang GT3",
    "drivers": [
      "Hubert Haupt",
      "Vincent Kolb",
      "David Schumacher",
      "Colin Caresani"
    ]
  },
  {
    "carNum": "#67",
    "team": "HRT Ford Racing",
    "car": "Ford Mustang GT3 EVO",
    "drivers": [
      "Dennis Olsen",
      "Christopher Mies",
      "Frederic Vervisch",
      "Frank Stippler"
    ]
  },
  {
    "carNum": "#69",
    "team": "Doerr Motorsport",
    "car": "McLaren 720S GT3",
    "drivers": [
      "Timo Glock",
      "Timo Scheider",
      "Ben Doerr",
      "Marvin Kirchhöfer"
    ]
  },
  {
    "carNum": "#77",
    "team": "Schubert Motorsport",
    "car": "BMW M4 GT3 EVO",
    "drivers": [
      "Marco Wittmann",
      "Philipp Eng",
      "Charles Weerts",
      "Robin Frijns"
    ]
  },
  {
    "carNum": "#80",
    "team": "Mercedes-AMG Team RAVENOL",
    "car": "Mercedes-AMG GT3",
    "drivers": [
      "Maro Engel",
      "Luca Stolz",
      "Fabian Schiller",
      "Maxime Martin"
    ]
  },
  {
    "carNum": "#84",
    "team": "Red Bull Team ABT",
    "car": "Lamborghini Huracan GT3 EVO2",
    "drivers": [
      "Luca Engstler",
      "Mirko Bortolotti",
      "Patric Niederhauser"
    ]
  },
  {
    "carNum": "#86",
    "team": "High Class Racing",
    "car": "Porsche 911 GT3 R (992)",
    "drivers": [
      "Kerong Li",
      "Ander Fjordbach",
      "Hongli Ye",
      "Harry King"
    ]
  },
  {
    "carNum": "#99",
    "team": "ROWE RACING",
    "car": "BMW M4 GT3 EVO",
    "drivers": [
      "Dan Harper",
      "Max Hesse",
      "Sheldon van der Linde",
      "Dries Vanthoor"
    ]
  },
  {
    "carNum": "#911",
    "team": "Manthey Racing",
    "car": "Porsche 911 GT3 R (992)",
    "drivers": [
      "Kevin Estre",
      "Ayhancan Güven",
      "Thomas Preining",
      "Matt Campbell"
    ]
  },
  {
    "carNum": "#4",
    "team": "Goroyan RT by Car Collection",
    "car": "Porsche 911 GT3 R (992)",
    "drivers": [
      "Artur Goroyan",
      "Oleg Kivtka",
      "Nathanael Berthon",
      "Alex Fontana"
    ]
  },
  {
    "carNum": "#18",
    "team": "Lionspeed GP",
    "car": "Porsche 911 GT3 R (992)",
    "drivers": [
      "Kyle Tilley",
      "Jake Hill",
      "Patrick Kolb",
      "Max Hofer"
    ]
  },
  {
    "carNum": "#30",
    "team": "Hankook Competition",
    "car": "Porsche 911 GT3 R (992)",
    "drivers": [
      "Jongkyum Kim",
      "Roelof Bruins",
      "Steven Cho",
      "Marco Seefried"
    ]
  },
  {
    "carNum": "#32",
    "team": "Toyo Tires with Ring Racing",
    "car": "Mercedes-AMG GT3",
    "drivers": [
      "Yuichi Nakayama",
      "Andreas Gülden",
      "Tim Sandtler"
    ]
  },
  {
    "carNum": "#33",
    "team": "KKrämer Racing",
    "car": "Audi R8 LMS GT3 evo II",
    "drivers": [
      "Tobias Vazquez-Garcia",
      "Fidel Leib",
      "Michele di Martino",
      "Christopher Bruck"
    ]
  },
  {
    "carNum": "#35",
    "team": "Walkenhorst Motorsport",
    "car": "Aston Martin Vantage AMR GT3",
    "drivers": [
      "Felipe Fernandez Laser",
      "Mateo Villagómez",
      "Dennis Fetzer",
      "Stefan Aust"
    ]
  },
  {
    "carNum": "#39",
    "team": "Walkenhorst Motorsport",
    "car": "Aston Martin Vantage AMR GT3",
    "drivers": [
      "Henry Walkenhorst",
      "Anders Buchardt",
      "Nico Hantke",
      "Mex Jansen"
    ]
  },
  {
    "carNum": "#48",
    "team": "BLACK FALCON LOSCH",
    "car": "Porsche 911 GT3 R (992)",
    "drivers": [
      "Daan Arrow",
      "Patrick Assenheimer",
      "Tobias Müller",
      "Dylan Pereira"
    ]
  },
  {
    "carNum": "#71",
    "team": "JUTA Racing",
    "car": "Audi R8 LMS GT3 evo II",
    "drivers": [
      "Otto Blank",
      "Pierre Kaffer",
      "Björn Großmann",
      "Christer Jöns"
    ]
  },
  {
    "carNum": "#123",
    "team": "Mühlner Motorsport",
    "car": "Porsche 911 GT3 R (992)",
    "drivers": [
      "Martin Rump",
      "Ben Bünnagel",
      "Alexander Brundle"
    ]
  },
  {
    "carNum": "#130",
    "team": "Red Bull Team ABT",
    "car": "Lamborghini Huracan GT3 EVO2",
    "drivers": [
      "Marco Mapelli",
      "Nicky Catsburg",
      "Nicholas Yelloly"
    ]
  },
  {
    "carNum": "#5",
    "team": "BLACK FALCON Team EAE",
    "car": "Porsche 911 GT3 R (992)",
    "drivers": [
      "Mustafa Mehmet Kaya",
      "Thomas Kiefer",
      "Gabriele Piana",
      "Mike Stursberg"
    ]
  },
  {
    "carNum": "#36",
    "team": "Saugmotoren Motorsport",
    "car": "BMW Z4 GT3",
    "drivers": [
      "Julian Reeh",
      "Valentin Lachenmayer",
      "Henry Walkenhorst",
      "Christian Scherer"
    ]
  },
  {
    "carNum": "#37",
    "team": "PROsport Racing",
    "car": "Aston Martin Vantage GT3",
    "drivers": [
      "Guido Dumarey",
      "Tobias Wahl",
      "Markus Lönnroth",
      "Christian Konnerth"
    ]
  },
  {
    "carNum": "#40",
    "team": "W.I.S Racing Team",
    "car": "BMW Z4 GT3",
    "drivers": [
      "Peter Posavac",
      "Michael Funke",
      "Volker Strycek",
      "Juan Carlos Carmona Chavez"
    ]
  },
  {
    "carNum": "#786",
    "team": "Renazzo Motorsport",
    "car": "Lamborghini Huracan GT3 EVO2",
    "drivers": [
      "Sak Nana",
      "Christoph Breuer",
      "Dieter Schmidtmann",
      "Thomas Mutsch"
    ]
  },
  {
    "carNum": "#90",
    "team": "Teichmann Racing",
    "car": "Toyota GR Supra GT4 EVO2",
    "drivers": [
      "Hugo Schwarze",
      "Lucas Cartelle",
      "Javier Sagrera",
      "Edgar Pierre"
    ]
  },
  {
    "carNum": "#145",
    "team": "Riller & Schnauck",
    "car": "BMW M4 GT4 EVO",
    "drivers": [
      "Peter Cate",
      "Joshua Bednarski",
      "Tom Schütze",
      "Jeroen Bleekemolen"
    ]
  },
  {
    "carNum": "#164",
    "team": "W&S Motorsport",
    "car": "Porsche 718 Cayman GT4 RS CS",
    "drivers": [
      "Stephan Brodmerkel",
      "Hendrik Still",
      "Jürgen Vöhringer",
      "Constantin Schöll"
    ]
  },
  {
    "carNum": "#176",
    "team": "PROsport Racing",
    "car": "Mercedes-AMG GT4",
    "drivers": [
      "Guilherme de Oliveira",
      "Yannik Himmels",
      "Lluc Ibañez",
      "Jörg Viebahn"
    ]
  },
  {
    "carNum": "#177",
    "team": "AV Racing by BLACK FALCON",
    "car": "BMW M4 GT4 EVO",
    "drivers": [
      "Malcolm Harrison",
      "Sergiu Nicolae",
      "Mark Smith",
      "Alexandru Vasilescu"
    ]
  },
  {
    "carNum": "#187",
    "team": "FK Performance Motorsport",
    "car": "BMW M4 GT4",
    "drivers": [
      "Luca Link",
      "Nick Wüstenhagen",
      "Leyton Fourie",
      "Moritz Wiskirchen"
    ]
  },
  {
    "carNum": "#888",
    "team": "Hofor Racing",
    "car": "BMW M4 GT4 EVO",
    "drivers": [
      "Max Partl",
      "Michael Schrey",
      "Philip Wiskirchen",
      "Thorsten Wolter"
    ]
  },
  {
    "carNum": "#169",
    "team": "Doerr Motorsport",
    "car": "Aston Martin Vantage GT4",
    "drivers": [
      "Peter Sander",
      "Heiko Hahn",
      "Roland Waschkau",
      "Philippe Charlaix"
    ]
  },
  {
    "carNum": "#171",
    "team": "BSL Racing Team",
    "car": "Porsche 718 Cayman GT4 RS CS",
    "drivers": [
      "Alexander Walker",
      "Eric Ullström",
      "Philipp Hagnauer",
      "Arno Klasen"
    ]
  },
  {
    "carNum": "#175",
    "team": "PROsport Racing",
    "car": "Mercedes-AMG GT4",
    "drivers": [
      "Jacques Derenne",
      "Carsten Kautz",
      "Gustav Bard",
      "Marcos Vazquez"
    ]
  },
  {
    "carNum": "#180",
    "team": "AV Racing by BLACK FALCON",
    "car": "BMW M4 GT4 EVO",
    "drivers": [
      "Judson Holt",
      "Dave Ogburn",
      "Denny Stripling",
      "Charles Russell Turner"
    ]
  },
  {
    "carNum": "#189",
    "team": "Hofor Racing by Bonk Motorsport",
    "car": "BMW M4 GT4 EVO",
    "drivers": [
      "Matin Kroll",
      "Michael Bonk",
      "Jörg Weidinger",
      "Ranko Mjatovic"
    ]
  },
  {
    "carNum": "#170",
    "team": "Toyo Tires with Ring Racing",
    "car": "Toyota GR Supra GT4 EVO2",
    "drivers": [
      "Giuliano Alesi",
      "Kazuto Kotaka",
      "Miki Koyama",
      "Shunji Okumoto"
    ]
  },
  {
    "carNum": "#59",
    "team": "Doerr Motorsport",
    "car": "McLaren Artura Trophy Evo",
    "drivers": [
      "Sven Schadler",
      "Frank Weishar",
      "Guido Naumann",
      "Phil Dorr"
    ]
  },
  {
    "carNum": "#82",
    "team": "Equipe não informada",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Marco Vitonelli",
      "Michael Schroder",
      "Jacek Pydys",
      "Sebastian Brandl"
    ]
  },
  {
    "carNum": "#91",
    "team": "Reiter Engineering",
    "car": "Porsche 911 GT3 Cup (991)",
    "drivers": [
      "Lukas Ertl",
      "Maximilian Ertl",
      "Stefan Ertl",
      "Matthias Benndorf"
    ]
  },
  {
    "carNum": "#420",
    "team": "Four Motors Bioconcept-Car",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Marc Schöni",
      "Oliver Sprungmann",
      "Henning Cramer",
      "Georg Kiefer"
    ]
  },
  {
    "carNum": "#50",
    "team": "Max Kruse Racing",
    "car": "VW Golf GTI Clubsport",
    "drivers": [
      "Benjamin Leuchter",
      "Johan Kristoffersen",
      "Heiko Hammel",
      "Nicholas Otto"
    ]
  },
  {
    "carNum": "#76",
    "team": "Max Kruse Racing",
    "car": "VW Golf GTI Clubsport",
    "drivers": [
      "Timo Hochwind",
      "Nicholas Otto",
      "Fabian Vettel",
      "Jonathan Mogotsi"
    ]
  },
  {
    "carNum": "#88",
    "team": "Subaru TECNICA INTERNATIONAL",
    "car": "Subaru WRX",
    "drivers": [
      "Carlo van Dam",
      "Kota Sasaki",
      "Takuto Iguchi",
      "Rintaro Kubo"
    ]
  },
  {
    "carNum": "#302",
    "team": "Hyundai Motorsport N",
    "car": "Hyundai Elantra N1 RP",
    "drivers": [
      "Manuel Lauck",
      "Youngchan Kim",
      "Mark Wallenwein",
      "Mikel Azcona"
    ]
  },
  {
    "carNum": "#303",
    "team": "Hyundai Motorsport N",
    "car": "Hyundai Elantra N1 RP",
    "drivers": [
      "Gyumin Kim",
      "Mark Wallenwein",
      "Woojin Shin",
      "Carlos Jose Sepulveda Irizarry"
    ]
  },
  {
    "carNum": "#152",
    "team": "Oepen Motorsport",
    "car": "BMW 325i",
    "drivers": [
      "Ingo Oepen",
      "Christian Koger",
      "Henrik Launhardt"
    ]
  },
  {
    "carNum": "#10",
    "team": "Max Kruse Racing",
    "car": "VW Golf GTI Clubsport",
    "drivers": [
      "Matthias Wasel",
      "Christoph Lenz",
      "Max Kruse",
      "Jens Dralle"
    ]
  },
  {
    "carNum": "#300",
    "team": "Ollis Garage Racing",
    "car": "Dacia Logan",
    "drivers": [
      "Oliver Kriese",
      "Christian Geilfus",
      "Robert Neumann",
      "Alexander Becker"
    ]
  },
  {
    "carNum": "#317",
    "team": "2R Racing",
    "car": "Audi TT RS",
    "drivers": [
      "Wolfgang Haugg",
      "Roland Waschkau",
      "Thorsten Jung",
      "Dirk Vleugels"
    ]
  },
  {
    "carNum": "#321",
    "team": "Sharky Racing",
    "car": "VW Golf GTI TCR",
    "drivers": [
      "Finn Mache",
      "Danny Brink",
      "Moritz Rosenbach",
      "Joris Primke"
    ]
  },
  {
    "carNum": "#800",
    "team": "asBest Racing",
    "car": "VW Golf GTI",
    "drivers": [
      "Manuel Dormagen",
      "Sven Oepen",
      "Thomas Ardelt, Tim Lukas Muller"
    ]
  },
  {
    "carNum": "#808",
    "team": "asBest Racing",
    "car": "Cupra TCR DSG",
    "drivers": [
      "Junichi Umemoto",
      "Son Geon",
      "Rafal Gieras, Samuel Hsieh"
    ]
  },
  {
    "carNum": "#821",
    "team": "Sharky Racing",
    "car": "Audi RS3 LMS DSG",
    "drivers": [
      "Mats Heidler",
      "Sascha Siegert, Stephen Epp, Alexander Weber"
    ]
  },
  {
    "carNum": "#277",
    "team": "RAVENOL Motorsport by MDM Racing",
    "car": "BMW 318ti",
    "drivers": [
      "Marc David Müller",
      "Henrik Seibel",
      "Leo Geisler, Michael Harris"
    ]
  },
  {
    "carNum": "#109",
    "team": "TOYOTA GAZOO ROOKIE Racing",
    "car": "Toyota GR Yaris",
    "drivers": [
      "Morizo",
      "Daisuke Toyoda",
      "Hiroaki Ishiura",
      "Kazuya Oshima"
    ]
  },
  {
    "carNum": "#110",
    "team": "TOYOTA GAZOO ROOKIE Racing",
    "car": "Toyota GR Yaris",
    "drivers": [
      "Morizo",
      "Daisuke Toyoda",
      "Masahiro Sasaki",
      "Kazuya Oshima"
    ]
  },
  {
    "carNum": "#380",
    "team": "BITTER",
    "car": "Opel Corsa GS Line",
    "drivers": [
      "Volker Strycek",
      "Christian Schäffer",
      "Björn Morhin",
      "Jan Soumagne"
    ]
  },
  {
    "carNum": "#13",
    "team": "Cargraphic by Kurt Ecke Motorsport",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Bernd Albrecht",
      "Kurt Ecke",
      "Andreas Sczepansky",
      "Mike Jager"
    ]
  },
  {
    "carNum": "#95",
    "team": "Sante Royal Racing",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Stefan Kiefer",
      "Marius Kiefer",
      "David Kiefer",
      "Luca Rettenbacher"
    ]
  },
  {
    "carNum": "#900",
    "team": "BLACK FALCON Zimmermann",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Alexander Hardt",
      "Benjamin Hites",
      "Benjamin Koslowski",
      "Paul Meijer"
    ]
  },
  {
    "carNum": "#902",
    "team": "BLACK FALCON LIQUI MOLY",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Ryan Harrison",
      "Noah Nagelsdiek",
      "Raphael Rennhofer",
      "Leon Wassertheurer"
    ]
  },
  {
    "carNum": "#918",
    "team": "Mühlner Motorsport",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Tim Scheerbarth",
      "Nick Salewsky",
      "Michael Rebhan",
      "Michelle Gatting"
    ]
  },
  {
    "carNum": "#919",
    "team": "Clickversicherung.de",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Robin Chrzanowski",
      "Kersten Jodexnis",
      "Richard-Sven Jodexnis",
      "Peter Scharmach"
    ]
  },
  {
    "carNum": "#925",
    "team": "Huber Motorsport",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Jon Miller",
      "Jaden Lander",
      "Jake Walker",
      "Hans Wehrmann"
    ]
  },
  {
    "carNum": "#777",
    "team": "RPM Racing",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Tracy Krohn",
      "Nic Jönsson",
      "Philip Hamprecht",
      "Patrick Huisman"
    ]
  },
  {
    "carNum": "#904",
    "team": "Mühlner Motorsport",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Antal Zsigo",
      "Adam Benko",
      "Csaba Walter",
      "Moritz Kranz"
    ]
  },
  {
    "carNum": "#908",
    "team": "Hofor Racing",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Michael Kroll",
      "Torsten Kratz",
      "Alex Prinz",
      "Thomas Mühlenz"
    ]
  },
  {
    "carNum": "#909",
    "team": "KKrämer Racing",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Peter Sander",
      "Karsten Krämer",
      "Leo Messenger",
      "Michelangelo Comazzi"
    ]
  },
  {
    "carNum": "#941",
    "team": "Adrenalin Motorsport",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Adrian Rziczny",
      "Mark van der Snel",
      "Max van der Snel",
      "Alexander Kroker"
    ]
  },
  {
    "carNum": "#959",
    "team": "SRS Team Sorg Rennsport",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Patrik Grütter",
      "Fabio Grosse",
      "Heiko Eichenberg",
      "Harley Hughton"
    ]
  },
  {
    "carNum": "#961",
    "team": "W&S Motorsport",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Marius Rauer",
      "Michal Makes",
      "Zhen Dong Zhang",
      "Chao Lu"
    ]
  },
  {
    "carNum": "#962",
    "team": "W&S Motorsport",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Moritz Oberheim",
      "Philip Miemois",
      "Lorenz Stegmann",
      "Niclas Wiedmann"
    ]
  },
  {
    "carNum": "#966",
    "team": "asBest Racing",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Jan-Niklas Stieler",
      "Moritz Oehme",
      "Leonhard Oehme",
      "Kasparas Vingils"
    ]
  },
  {
    "carNum": "#967",
    "team": "Breakell Racing",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Martin Rich",
      "Karim Sekkat",
      "Pippa Man",
      "Josh Hislop"
    ]
  },
  {
    "carNum": "#971",
    "team": "Speedworxx Automotive",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Franz Linden",
      "Oskar Sandberg",
      "Alexander Fielenbach",
      "Erik Braun"
    ]
  },
  {
    "carNum": "#979",
    "team": "SRS Team Sorg Rennsport",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Maximilian",
      "Damon Surzyshyn",
      "Seth Brown",
      "Christian Coen"
    ]
  },
  {
    "carNum": "#999",
    "team": "Mühlner Motorsport",
    "car": "Porsche 718 Cayman GT4 RS",
    "drivers": [
      "Maxwell Polzler",
      "Christopher Rink",
      "Kai Riemer",
      "Matthias Beckwemert"
    ]
  },
  {
    "carNum": "#939",
    "team": "BLACK FALCON Zimmermann",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Alezander Kroker",
      "Anton Ruf",
      "Axel Sartingen",
      "Nils Schwenk"
    ]
  },
  {
    "carNum": "#945",
    "team": "Renazzo Motorsport",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Markus Nölken",
      "Daniel Nölken, Alexander Meixner",
      "Kouichi Okumura"
    ]
  },
  {
    "carNum": "#949",
    "team": "SRS Team Sorg Rennsport",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Aaron Wenisch",
      "Tommy Graberg",
      "Akshay Gupta",
      "Björn Simon"
    ]
  },
  {
    "carNum": "#952",
    "team": "Smyrlis Racing",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Christian Kraus",
      "Peder Saltvedt",
      "Alex Koch",
      "Henry Lindloff"
    ]
  },
  {
    "carNum": "#969",
    "team": "SRS Team Sorg Rennsport",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Kurt Strube",
      "Guy Stewart",
      "Bernhard Wagner",
      "Josh Jacobs"
    ]
  },
  {
    "carNum": "#977",
    "team": "BSL Racing Team",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Marcel Zimmermann",
      "Marc Arn",
      "Philipp Frommenwiler",
      "Christoph Ruhrmann"
    ]
  },
  {
    "carNum": "#978",
    "team": "KKrämer Racing",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Olaf Baunack",
      "Marco Lamsouguer",
      "Mario Handrick",
      "Michael Monch"
    ]
  },
  {
    "carNum": "#982",
    "team": "W&S Motorsport",
    "car": "Porsche 718 Cayman GT4",
    "drivers": [
      "Christoph Krombach",
      "Oliver Kunz",
      "Axel Duffner",
      "Leo-Livius Arne Weber"
    ]
  },
  {
    "carNum": "#89",
    "team": "Equipe não informada",
    "car": "VW Golf 7 GTi",
    "drivers": [
      "Marco Knappmeier",
      "Malk Knappmeier",
      "Dirk Groneck"
    ]
  },
  {
    "carNum": "#577",
    "team": "asBest Racing",
    "car": "Cupra Leon Competición",
    "drivers": [
      "Lutz Obermann",
      "Dennis Leissing",
      "Max Rosam",
      "Mark Trompeter"
    ]
  },
  {
    "carNum": "#776",
    "team": "Sharky Racing",
    "car": "Audi RS3 LMS SEQ",
    "drivers": [
      "Ivars Vallers",
      "Gian Maria Gabbiani",
      "Mikaela Ahlin-Kottulinsky",
      "Philipp Eis"
    ]
  },
  {
    "carNum": "#830",
    "team": "Hyundai Motorsport N",
    "car": "Hyundai Elantra N TCR",
    "drivers": [
      "Marc Basseng",
      "Manuel Lauck",
      "Nico Bastian",
      "Mikel Azcona"
    ]
  },
  {
    "carNum": "#100",
    "team": "EiFelkind Racing",
    "car": "BMW 325i",
    "drivers": [
      "Markus Fischer",
      "Oliver Frisse",
      "Christopher Gruber",
      "Henning Hausmeier"
    ]
  },
  {
    "carNum": "#101",
    "team": "EiFelkind Racing",
    "car": "BMW 325i",
    "drivers": [
      "Tim Schwolow",
      "Nils Renken",
      "Marco Schmitz"
    ]
  },
  {
    "carNum": "#108",
    "team": "asBest Racing",
    "car": "BMW 325i",
    "drivers": [
      "Alex Schneider",
      "Marco Grill",
      "Sarah Ganser",
      "Richard Bather"
    ]
  },
  {
    "carNum": "#112",
    "team": "JS Competition",
    "car": "BMW 325i",
    "drivers": [
      "Eugen Becker",
      "Jonas Spölgen",
      "Flurin Zimmermann",
      "Bernd Kupper"
    ]
  },
  {
    "carNum": "#870",
    "team": "Adrenalin Motorsport",
    "car": "BMW M2 Racing G87",
    "drivers": [
      "Ryusho Konishi",
      "Yunfeng Zou",
      "Alesia Kreutzpointer",
      "Jacqueline Kreutzpointner"
    ]
  },
  {
    "carNum": "#878",
    "team": "SRS Team Sorg Rennsport",
    "car": "BMW M2 Racing G87",
    "drivers": [
      "Maximilian Hill",
      "Tim Peeters",
      "Max Schlichenmeier",
      "Darian Donkel"
    ]
  },
  {
    "carNum": "#898",
    "team": "Walkenhorst Motorsport",
    "car": "BMW M2 Racing G87",
    "drivers": [
      "Bennet Ehrl",
      "Tazio Ottis",
      "Maxim Felix Dacher",
      "Takayuki Kinoshita"
    ]
  },
  {
    "carNum": "#899",
    "team": "W&S Motorsport",
    "car": "BMW M2 CS Racing",
    "drivers": [
      "Yanis Anhorn",
      "Frank Anhorn",
      "Max Lamesch",
      "John Marchal"
    ]
  },
  {
    "carNum": "#195",
    "team": "Adrenalin Motorsport",
    "car": "BMW M240i Racing Cup",
    "drivers": [
      "Moran Gott",
      "Hagay Farran",
      "Filip Hoenjet"
    ]
  },
  {
    "carNum": "#650",
    "team": "Adrenalin Motorsport",
    "car": "BMW M240i",
    "drivers": [
      "Sven Markert",
      "Benjamin Albers",
      "Santiago Baztarrica",
      "Yannick Fübrich"
    ]
  },
  {
    "carNum": "#651",
    "team": "Adrenalin Motorsport",
    "car": "BMW M240i",
    "drivers": [
      "Kevin Wambach",
      "Nico Silva",
      "Johnny Huang",
      "Ke Shao"
    ]
  },
  {
    "carNum": "#652",
    "team": "Adrenalin Motorsport",
    "car": "BMW M240i",
    "drivers": [
      "Aldrin Opran",
      "Grégoire Boutonnet",
      "Laurent Laparra",
      "Oleg Kravets"
    ]
  },
  {
    "carNum": "#653",
    "team": "Adrenalin Motorsport",
    "car": "BMW M240i",
    "drivers": [
      "Farquini",
      "Ben Pitch",
      "Axel Soyez",
      "Edoardo Bugane"
    ]
  },
  {
    "carNum": "#658",
    "team": "JJ Motorsport",
    "car": "BMW M240i",
    "drivers": [
      "Hakan Sari",
      "Recep Sari",
      "Ersin Yücesan"
    ]
  },
  {
    "carNum": "#665",
    "team": "WS Racing",
    "car": "BMW M240i",
    "drivers": [
      "Jan Ullrich",
      "Ulf Steffens",
      "John Von der Sanden",
      "Jannik Reinhard"
    ]
  },
  {
    "carNum": "#667",
    "team": "Breakell Racing",
    "car": "BMW M240i",
    "drivers": [
      "Andreas Simon",
      "Aidan Mulready",
      "James Breakell",
      "Alvaro Fontes"
    ]
  },
  {
    "carNum": "#669",
    "team": "Keeevin Motorsport",
    "car": "BMW M240i",
    "drivers": [
      "Riccardo Petrolo",
      "Maximilian Kurz",
      "Zeynel Babacan"
    ]
  },
  {
    "carNum": "#670",
    "team": "WS Racing",
    "car": "BMW M240i",
    "drivers": [
      "Adrien Paviot",
      "Valentin Belgy",
      "Michael Brautigam",
      "Dennis Garbe"
    ]
  },
  {
    "carNum": "#677",
    "team": "asBest Racing",
    "car": "BMW M240i",
    "drivers": [
      "Marco Grilli",
      "Thomas Alpiger",
      "Michael Neuhauser",
      "Sebastian Tauber"
    ]
  },
  {
    "carNum": "#19",
    "team": "Max Kruse Racing",
    "car": "Audi R8 LMS GT3 evo II",
    "drivers": [
      "Jan Jaap van Roon",
      "Tom Coronel",
      "Christian Kohlhaas",
      "Duncan Huismann"
    ]
  },
  {
    "carNum": "#75",
    "team": "Max Kruse Racing",
    "car": "Audi R8 LMS GT3 evo II",
    "drivers": [
      "Dominik Fugel",
      "Marcel Fugel",
      "Benjamin Leuchter",
      "Tom Coronel"
    ]
  },
  {
    "carNum": "#146",
    "team": "GITI Tire Motorsport by WS Racing",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Carrie Schreiner",
      "Janina Schall",
      "Michelle Halder",
      "Fabienne Wohlwend"
    ]
  },
  {
    "carNum": "#320",
    "team": "Four Motors Bioconcept-Car",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Smudo",
      "Henrik Bollerslev",
      "Marco van Ramshorst",
      "Nano Lopez"
    ]
  },
  {
    "carNum": "#632",
    "team": "BLACK FALCON FANATEC",
    "car": "Porsche 911 GT3 Cup (992)",
    "drivers": [
      "Jimmy Broadbent",
      "Steve Brown",
      "Misha Charoudin",
      "Manuel Metzger"
    ]
  },
  {
    "carNum": "#440",
    "team": "QTQ Raceperformance",
    "car": "Porsche Cayman CM12",
    "drivers": [
      "Mirco Böhmisch",
      "Florian Ebener",
      "Andreas Müller",
      "Florian Quante"
    ]
  },
  {
    "carNum": "#444",
    "team": "Adrenalin Motorsport",
    "car": "Porsche Cayman CM12",
    "drivers": [
      "Ulrich Korn",
      "Tobias Korn",
      "Daniel Korn",
      "Serghei Levlev"
    ]
  },
  {
    "carNum": "#445",
    "team": "rent2Drive MEHRTEC",
    "car": "Porsche Cayman CM12",
    "drivers": [
      "Georg Arbinger",
      "Joel Le Bihan",
      "Philip Ade",
      "Jan Karsten Welker"
    ]
  },
  {
    "carNum": "#454",
    "team": "Pure Racing",
    "car": "Porsche Cayman CM12",
    "drivers": [
      "John Lee Schambony",
      "Jan Hendrik Heimbach",
      "Andreas Hansen",
      "Peter Baumann"
    ]
  },
  {
    "carNum": "#455",
    "team": "Pure Racing",
    "car": "Porsche Cayman CM12",
    "drivers": [
      "Peter Baumann",
      "Matthias Trinius",
      "Thorsten Held",
      "John Lee Schambony"
    ]
  },
  {
    "carNum": "#396",
    "team": "Adrenalin Motorsport",
    "car": "Porsche Cayman S",
    "drivers": [
      "Klaus Faßbender",
      "Christian Büllesbach",
      "Andreas Schettler",
      "Carlos Arimon"
    ]
  },
  {
    "carNum": "#410",
    "team": "rent2Drive MEHRTEC",
    "car": "Porsche Cayman GTS",
    "drivers": [
      "Stefano Croci",
      "Jérôme Larbi",
      "David Ackermann",
      "Matiss Mezaks"
    ]
  },
  {
    "carNum": "#415",
    "team": "Köppen Motorsport",
    "car": "Porsche 911 Carrera",
    "drivers": [
      "Alexander Köppen",
      "Sebastian Rings",
      "Bastian Arend",
      "Maximilian Arnold"
    ]
  },
  {
    "carNum": "#418",
    "team": "SRS Team Sorg Rennsport",
    "car": "Porsche Cayman S",
    "drivers": [
      "Xavier Lamadrid",
      "Cesar Mendieta",
      "Luis Ramirez",
      "Tabea Junger"
    ]
  },
  {
    "carNum": "#448",
    "team": "OVERTAKERACING",
    "car": "Porsche Cayman S",
    "drivers": [
      "Christian Weber",
      "Christian Knötschke",
      "Alexander Müller",
      "Torsten Krey"
    ]
  },
  {
    "carNum": "#471",
    "team": "Jung Motorsport",
    "car": "Cupra Leon KL",
    "drivers": [
      "Michael Eichhorn",
      "Tony Roma",
      "Andreas Winterwerber"
    ]
  },
  {
    "carNum": "#472",
    "team": "Jung Motorsport",
    "car": "Cupra Leon KL",
    "drivers": [
      "Lars Füting",
      "Marc Etzkorn",
      "Thanathip Thanalapanan",
      "Marcel Müller"
    ]
  },
  {
    "carNum": "#474",
    "team": "Time Attack Paderborn",
    "car": "VW Golf",
    "drivers": [
      "Boris Hrubesch",
      "Fritz Hebig",
      "Fabian Tillmann",
      "Michael Wolpertinger"
    ]
  },
  {
    "carNum": "#477",
    "team": "asBest Racing",
    "car": "VW Scirocco R",
    "drivers": [
      "Bastian Beck",
      "Michael Lachmeyer"
    ]
  },
  {
    "carNum": "#480",
    "team": "Dupré Motorsport Engineering",
    "car": "Audi S3 Limousine",
    "drivers": [
      "Christoph Dupré",
      "Jürgen Nett",
      "Joachim Nett"
    ]
  },
  {
    "carNum": "#500",
    "team": "Adrenalin Motorsport",
    "car": "BMW 330i",
    "drivers": [
      "Philipp Stahlschmidt",
      "Philipp Leisen",
      "Daniel Zils, Sub7BTG"
    ]
  },
  {
    "carNum": "#501",
    "team": "Adrenalin Motorsport",
    "car": "BMW 330i",
    "drivers": [
      "Christoph Merkt",
      "Marvin Kobus",
      "Hermann Vortkamp",
      "Jurgen Huber"
    ]
  },
  {
    "carNum": "#503",
    "team": "WS Racing",
    "car": "Toyota Supra",
    "drivers": [
      "Fabian Pirrone",
      "Thomas Ehrhardt",
      "Niklas Ehrhardt",
      "Julia Ponkratz"
    ]
  },
  {
    "carNum": "#514",
    "team": "SRS Team Sorg Rennsport",
    "car": "BMW 330i",
    "drivers": [
      "Ugo Vicenzi",
      "Alberto Carobbio",
      "Heinz Jürgen Kroner",
      "Calvin De Groot"
    ]
  },
  {
    "carNum": "#519",
    "team": "RAVENOL Japan",
    "car": "Toyota Supra",
    "drivers": [
      "Malte Tack",
      "Manfred Röss",
      "Matthias Röss"
    ]
  },
  {
    "carNum": "#520",
    "team": "Toyo Tires Ring Racing",
    "car": "Toyota Supra",
    "drivers": [
      "Takuma Miyazono",
      "Masato Kawabata",
      "Hokuto Matsuyama",
      "Jin Horino"
    ]
  },
  {
    "carNum": "#524",
    "team": "SRS Team Sorg Rennsport",
    "car": "Toyota Supra",
    "drivers": [
      "Piet-Jan Ooms",
      "Yutaka Seki",
      "Mathias Baar",
      "Maximilian Eisberg"
    ]
  },
  {
    "carNum": "#569",
    "team": "NFR Motorsports",
    "car": "BMW 330i",
    "drivers": [
      "Lars Van’t Veer",
      "Benny Baller",
      "Max de Bruijn",
      "Stefan Gaukler"
    ]
  },
  {
    "carNum": "#61",
    "team": "HWA Engineering Speed",
    "car": "HWA Evo R",
    "drivers": [
      "Adam Adelson",
      "Lance David Arnold",
      "James Green",
      "Renger van der Zande"
    ]
  },
  {
    "carNum": "#62",
    "team": "HWA Engineering Speed",
    "car": "HWA Evo R",
    "drivers": [
      "Adam Adelson",
      "Sebastian Asch",
      "Luca Ludwig",
      "Markus Winkelhock"
    ]
  },
  {
    "carNum": "#63",
    "team": "HWA Engineering Speed",
    "car": "HWA Evo R",
    "drivers": [
      "Christian Gebhardt",
      "Evald Holstad",
      "Peter Ludwig",
      "Bruno Spengler"
    ]
  },
  {
    "carNum": "#66",
    "team": "Reiter Engineering",
    "car": "KTM X-Bow GTX",
    "drivers": [
      "Miklas Born",
      "Arne Hoffmeister",
      "Marcel Marchewicz",
      "Laurents Hörr"
    ]
  },
  {
    "carNum": "#81",
    "team": "BMW M Motorsport",
    "car": "BMW M3 Touring 24h",
    "drivers": [
      "Jens Kingmann",
      "Ugo de Wilde",
      "Connor de Phillippi",
      "Neil Verhagen"
    ]
  },
  {
    "carNum": "#992",
    "team": "Manthey Team eFuel",
    "car": "Porsche 911 GT3 Cup",
    "drivers": [
      "Björn Griesemann",
      "Georg Griesemann",
      "Dirk Adorf",
      "Marco Holzer"
    ]
  }
];


function splitDriverCarNums(driver: DriverCard) {
  return String(driver.carNum)
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.startsWith("#") ? part : `#${part}`));
}

function makeRosterDriver(entry: { carNum: string; team: string; car: string; drivers: string[] }, name: string): DriverCard {
  const highlighted = pilotsSeed.find((driver) => {
    return driver.name.toLowerCase() === name.toLowerCase() && splitDriverCarNums(driver).includes(entry.carNum);
  });

  if (highlighted) {
    return {
      ...highlighted,
      carNum: entry.carNum,
      team: entry.team || highlighted.team,
      car: entry.car || highlighted.car
    };
  }

  return {
    name,
    nationality: "—",
    carNum: entry.carNum,
    team: entry.team,
    car: entry.car,
    role: "piloto inscrito",
    won24h: "Histórico não cadastrado no app",
    history: `Piloto inscrito no ${entry.team} para as 24h de Nürburgring 2026 com o ${entry.car}.`,
    watch: `Acompanhar o stint no ${entry.carNum}: ritmo, tráfego, paradas e possíveis mensagens de Race Control.`
  };
}

const rosterDriversSeed: DriverCard[] = rosterSeed.flatMap((entry) => entry.drivers.map((name) => makeRosterDriver(entry, name)));
const extraHighlightedDriversSeed = pilotsSeed.filter((driver) => {
  return !rosterDriversSeed.some((rosterDriver) => {
    return rosterDriver.name.toLowerCase() === driver.name.toLowerCase() && splitDriverCarNums(driver).some((num) => num === rosterDriver.carNum);
  });
});
const allDriversSeed: DriverCard[] = [...rosterDriversSeed, ...extraHighlightedDriversSeed];

function timeToSec(time: string) {
  if (!time || !time.includes(":")) return null;
  const [m, s] = time.trim().split(":");
  const sec = Number((s || "").replace(",", "."));
  const min = Number(m);
  if (Number.isNaN(min) || Number.isNaN(sec)) return null;
  return min * 60 + sec;
}

function gap(time: string, best: string) {
  const a = timeToSec(time);
  const b = timeToSec(best);
  if (a === null || b === null) return "";
  const g = a - b;
  return Math.abs(g) < 0.001 ? "—" : `+${g.toFixed(3)}s`;
}

function classifyRaceMessage(text: string): RaceControlMessage["type"] {
  const lower = text.toLowerCase();

  if (lower.includes("no further action")) return "no-action";
  if (lower.includes("technical flag") || lower.includes("black/orange") || lower.includes("black flag")) return "technical";
  if (lower.includes("code 60") || lower.includes("code60")) return "code60";
  if (lower.includes("under investigation") || lower.includes("reported to the stewards")) return "investigation";
  if (lower.includes("penalty") || lower.includes("time penalty") || lower.includes("stop and go") || lower.includes("non respect") || lower.includes("non rescpect")) return "penalty";
  if (lower.includes("gps")) return "gps";

  return "info";
}

function getRaceMessageTone(type: RaceControlMessage["type"]) {
  if (type === "penalty" || type === "technical") return "red";
  if (type === "investigation" || type === "code60") return "amber";
  if (type === "gps") return "blue";
  if (type === "no-action") return "green";
  return "gray";
}

function isUrgentRaceMessage(type: RaceControlMessage["type"]) {
  return type === "penalty" || type === "investigation" || type === "technical" || type === "code60";
}

function getRaceGroupTone(messages: RaceControlMessage[]) {
  if (messages.some((msg) => msg.type === "penalty" || msg.type === "technical")) return "red";
  if (messages.some((msg) => msg.type === "investigation" || msg.type === "code60")) return "amber";
  if (messages.some((msg) => msg.type === "gps")) return "blue";
  if (messages.some((msg) => msg.type === "no-action")) return "green";
  return "gray";
}

function getRaceGroupRank(group: RaceControlGroup) {
  if (group.tone === "red") return 4;
  if (group.tone === "amber") return 3;
  if (group.tone === "blue") return 2;
  if (group.tone === "green") return 1;
  return 0;
}

function getRaceCardClass(tone: string) {
  const classes: Record<string, string> = {
    red: "border-red-200 bg-red-50",
    amber: "border-amber-200 bg-amber-50",
    blue: "border-blue-200 bg-blue-50",
    green: "border-emerald-200 bg-emerald-50",
    gray: "border-zinc-200 bg-white"
  };
  return classes[tone] || classes.gray;
}


function formatRaceMessageType(type: string) {
  const labels: Record<string, string> = {
    Tudo: "Tudo",
    Todas: "Todas",
    penalty: "Punição",
    investigation: "Investigação",
    technical: "Técnico",
    code60: "Code 60",
    gps: "GPS",
    "no-action": "Sem ação",
    info: "Informação"
  };
  return labels[type] || type;
}

function translateRaceMessage(text: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\bplease check (?:your|you) driver id\b/gi, "verifique o ID do piloto"],
    [/\bdriver id\b/gi, "ID do piloto"],
    [/\bis reported to the stewards\b/gi, "foi encaminhado aos comissários"],
    [/\breporting to the stewards\b/gi, "encaminhamento aos comissários"],
    [/\bdriving maneuver\b/gi, "manobra de condução"],
    [/\bnon rescpect of the speed limit\b/gi, "não respeitou o limite de velocidade"],
    [/\bnon respect of the speed limit\b/gi, "não respeitou o limite de velocidade"],
    [/\bno respect of the speed limit\b/gi, "não respeitou o limite de velocidade"],
    [/\bnon rescpect of code 60\b/gi, "não respeitou Code 60"],
    [/\bnon respect of code 60\b/gi, "não respeitou Code 60"],
    [/\bno respect of code 60\b/gi, "não respeitou Code 60"],
    [/\bnon respect code 60\b/gi, "não respeitou Code 60"],
    [/\bno respect code 60\b/gi, "não respeitou Code 60"],
    [/\bnon rescpect of double yellow\b/gi, "não respeitou bandeira amarela dupla"],
    [/\bnon respect of double yellow\b/gi, "não respeitou bandeira amarela dupla"],
    [/\bno respect of double yellow\b/gi, "não respeitou bandeira amarela dupla"],
    [/\bnon rescpect of\b/gi, "não respeitou"],
    [/\bnon respect of\b/gi, "não respeitou"],
    [/\bno respect of\b/gi, "não respeitou"],
    [/\bat the end of the first race lap\b/gi, "no fim da primeira volta de corrida"],
    [/\bend of the first race lap\b/gi, "fim da primeira volta de corrida"],
    [/\bfirst race lap\b/gi, "primeira volta de corrida"],
    [/\bstart after the starting group\b/gi, "larga atrás do grupo de largada"],
    [/\bstop and go penalty of (\d+)\s*sec\b/gi, "penalidade de stop and go de $1 s"],
    [/\bstop and go penalty\b/gi, "penalidade de stop and go"],
    [/\bstop and go\b/gi, "stop and go"],
    [/\bDMSB penalty points\b/gi, "pontos de penalidade DMSB"],
    [/\bpenalty points\b/gi, "pontos de penalidade"],
    [/\bfor the next race\b/gi, "para a próxima corrida"],
    [/\b(\d+)\s*sec\b/gi, "$1 s"],
    [/\bdouble yellow\b/gi, "bandeira amarela dupla"],
    [/\bnon rescpect\b/gi, "não respeitou"],
    [/\bnon respect\b/gi, "não respeitou"],
    [/\bcar\b/gi, "carro"],
    [/\bdriver\b/gi, "piloto"],
    [/\bteam\b/gi, "equipe"],
    [/\blap\b/gi, "volta"],
    [/\bsector\b/gi, "setor"],
    [/\bpits?\b/gi, "box"],
    [/\bpit lane\b/gi, "pit lane"],
    [/\bunder investigation\b/gi, "sob investigação"],
    [/\breported to the stewards\b/gi, "encaminhado aos comissários"],
    [/\bno further action\b/gi, "sem ação adicional"],
    [/\btime penalty\b/gi, "penalidade de tempo"],
    [/\bpenalty\b/gi, "penalidade"],
    [/\btechnical flag\b/gi, "bandeira técnica"],
    [/\bblack\/orange flag\b/gi, "bandeira preta e laranja"],
    [/\bcode 60\b/gi, "Code 60"],
    [/\byellow flags?\b/gi, "bandeira amarela"],
    [/\bdouble yellow flags?\b/gi, "bandeira amarela dupla"],
    [/\bgreen flag\b/gi, "bandeira verde"],
    [/\bred flag\b/gi, "bandeira vermelha"],
    [/\bblack flag\b/gi, "bandeira preta"],
    [/\bspeed limit\b/gi, "limite de velocidade"],
    [/\btrack limits\b/gi, "limites de pista"],
    [/\bunsafe release\b/gi, "saída insegura do box"],
    [/\bcausing a collision\b/gi, "causou colisão"],
    [/\bovertaking\b/gi, "ultrapassagem"],
    [/\bnot respecting\b/gi, "não respeitou"],
    [/\bslow zone\b/gi, "zona lenta"],
    [/\bmeatball\b/gi, "bandeira técnica"]
  ];

  return replacements.reduce((translated, [pattern, replacement]) => translated.replace(pattern, replacement), text);
}

function readRaceField(msg: RaceControlRawMessage, keys: string[]) {
  if (typeof msg !== "object" || msg === null) return "";
  for (const key of keys) {
    const value = msg[key];
    if (value !== undefined && value !== null) return String(value).trim();
  }
  return "";
}

function normalizeRaceMessages(messages: RaceControlRawMessage[]): RaceControlMessage[] {
  return messages.map((msg) => {
    const rawText = readRaceField(msg, ["MESSAGE", "MSG", "TEXT", "MESSAGE_TEXT", "DESCRIPTION", "NOTE"]);
    const fallbackText = typeof msg === "string" ? msg : "";
    const message = rawText || fallbackText || JSON.stringify(msg);
    const explicitCar = readRaceField(msg, ["STNR", "CARNO", "CARNUMBER", "CAR_NUMBER"]);
    const carMatch = message.match(/#\s?(\d+)/) ?? explicitCar.match(/(\d+)/);
    const carNum = carMatch ? `#${carMatch[1]}` : "";
    const timeFromText = message.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0] ?? "";
    const time = readRaceField(msg, ["TIME", "TIMESTAMP", "LOCALTIME", "TOD"]) || timeFromText;

    return {
      time,
      carNum,
      message,
      translatedMessage: translateRaceMessage(message),
      type: classifyRaceMessage(message),
      raw: msg
    };
  });
}

function getRaceMessageKey(message: RaceControlMessage) {
  return `${message.time}|${message.carNum}|${message.message}`;
}

function truncateText(text: string, max = 160) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatDuration(ms: number) {
  if (ms <= 0) return "00d 00h 00m 00s";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(d).padStart(2, "0")}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}


function sortTimingRows(rows: QRow[]) {
  return [...rows]
    .map((r, idx) => {
      const livePos = Number(r.pos);
      return {
        ...r,
        _idx: idx,
        sec: timeToSec(r.time),
        livePos: Number.isFinite(livePos) && livePos > 0 ? livePos : undefined
      };
    })
    .sort((a, b) => {
      const aPos = a.livePos ?? Number.POSITIVE_INFINITY;
      const bPos = b.livePos ?? Number.POSITIVE_INFINITY;
      if (aPos !== bPos) return aPos - bPos;
      const aSec = a.sec ?? Number.POSITIVE_INFINITY;
      const bSec = b.sec ?? Number.POSITIVE_INFINITY;
      if (aSec !== bSec) return aSec - bSec;
      return a._idx - b._idx;
    })
    .map((r, i) => ({ ...r, pos: r.livePos ?? i + 1 }));
}

function Badge({ children, tone = "gray" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    red: "bg-red-700 text-white",
    gray: "bg-zinc-100 text-zinc-700",
    green: "bg-emerald-700 text-white",
    amber: "bg-amber-500 text-zinc-950",
    blue: "bg-blue-700 text-white",
    dark: "bg-zinc-900 text-white"
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.gray}`}>{children}</span>;
}

function CardBox({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function RaceControlGroupCard({ group, dense = false }: { group: RaceControlGroup; dense?: boolean }) {
  const latest = group.latest;

  return (
    <div className={`rounded-2xl border p-4 ${getRaceCardClass(group.tone)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-black text-zinc-950">{group.num}</span>
            <Badge tone={group.tone}>{formatRaceMessageType(latest.type)}</Badge>
            <Badge tone="gray">{group.messages.length} msg</Badge>
            {group.live && <Badge tone="blue">P{group.live.pos || "—"}</Badge>}
          </div>
          {group.car && <div className="mt-1 text-sm font-bold text-zinc-800">{group.car.team}</div>}
          {group.car && <div className="text-xs text-zinc-600">{group.car.car} • {group.car.cls}</div>}
        </div>
        {latest.time && <div className="text-xs font-black text-zinc-500">{latest.time}</div>}
      </div>

      <div className="mt-3 text-sm font-bold leading-5">{truncateText(latest.translatedMessage, dense ? 120 : 190)}</div>
      {!dense && group.messages.length > 1 && (
        <div className="mt-2 text-xs font-semibold text-zinc-600">
          Mais {group.messages.length - 1} mensagem{group.messages.length > 2 ? "s" : ""} para este carro.
        </div>
      )}
      {group.live && !dense && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-700">
          <span>Live: P{group.live.pos || "—"}</span>
          <span>{group.live.time || "sem tempo"}</span>
          <span>{group.live.cls}</span>
        </div>
      )}
    </div>
  );
}

function Input({ value, onChange, placeholder, className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-600 ${className}`} />;
}

function StatBox({ title, value, note, tone = "gray" }: { title: string; value: string; note?: string; tone?: string }) {
  const bg = tone === "red" ? "bg-red-50" : tone === "green" ? "bg-emerald-50" : tone === "amber" ? "bg-amber-50" : "bg-zinc-50";
  return <div className={`rounded-2xl ${bg} p-4`}><div className="text-xs font-black uppercase tracking-wider text-zinc-500">{title}</div><div className="mt-1 text-2xl font-black md:text-3xl">{value}</div>{note && <div className="mt-1 text-sm text-zinc-600">{note}</div>}</div>;
}

function isPitState(value?: string) {
  const clean = String(value ?? "").trim().toLowerCase();
  return !!clean && clean !== "0" && clean !== "false" && clean !== "null";
}


function getLiveClassTone(cls?: string) {
  const c = String(cls || "").toUpperCase();
  if (c.includes("SP 9") || c === "SP9") return "red";
  if (c.includes("CUP")) return "amber";
  if (c.includes("TCR")) return "blue";
  if (c.includes("VT") || c.includes("V5") || c.includes("V6") || c.includes("PRODUCTION")) return "green";
  if (c.includes("SP-X") || c.includes("SP PRO") || c.includes("SP-PRO")) return "dark";
  return "gray";
}

function getLiveClassAccent(cls?: string) {
  const tone = getLiveClassTone(cls);
  if (tone === "red") return "border-l-red-700";
  if (tone === "amber") return "border-l-amber-500";
  if (tone === "blue") return "border-l-blue-700";
  if (tone === "green") return "border-l-emerald-700";
  if (tone === "dark") return "border-l-zinc-900";
  return "border-l-zinc-300";
}

function getLiveRowBaseClass(index: number, raceGroup?: RaceControlGroup, isFavorite?: boolean) {
  if (raceGroup?.tone === "red") return "bg-red-50";
  if (raceGroup?.tone === "amber") return "bg-amber-50";
  if (raceGroup?.tone === "blue") return "bg-blue-50";
  if (isFavorite) return "bg-yellow-50";
  return index % 2 ? "bg-white" : "bg-zinc-50";
}

function LiveTimingRow({ row, index, leaderTime, raceGroup, isFavorite }: { row: QRow; index: number; leaderTime: string; raceGroup?: RaceControlGroup; isFavorite?: boolean }) {
  const positionChange = Number(row.change || 0);
  const hasPit = isPitState(row.pitState);
  const isTopTen = Number(row.pos || index + 1) <= 10;
  const classTone = getLiveClassTone(row.cls);
  const rowClass = `${getLiveRowBaseClass(index, raceGroup, isFavorite)} ${getLiveClassAccent(row.cls)} border-b border-l-4 border-zinc-100 align-top transition hover:bg-zinc-100`;

  return (
    <tr className={rowClass}>
      <td className="px-3 py-2 font-black">
        <div className="flex flex-wrap items-center gap-1">
          <span>P{row.pos || index + 1}</span>
          {positionChange !== 0 && <Badge tone={positionChange > 0 ? "green" : "red"}>{positionChange > 0 ? "+" + positionChange : positionChange}</Badge>}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-black text-red-700">{row.num}</span>
          {isFavorite && <Badge tone="amber">★ Fav</Badge>}
          {isTopTen && <Badge tone="dark">Top 10</Badge>}
          {hasPit && <Badge tone="amber">PIT</Badge>}
          {raceGroup && <Badge tone={raceGroup.tone}>RC</Badge>}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="font-bold">{row.team || "—"}</div>
        {raceGroup && <button onClick={() => window.dispatchEvent(new CustomEvent("open-race-control"))} className="mt-1 text-xs font-black text-red-700 underline decoration-red-300 underline-offset-2">ver RC</button>}
      </td>
      <td className="px-3 py-2 text-zinc-700">{row.car || "—"}</td>
      <td className="px-3 py-2"><Badge tone={classTone}>{row.cls || "—"}</Badge></td>
      <td className="px-3 py-2">
        <div className="font-black">{row.time || "—"}</div>
        {row.lastLap && <div className="text-xs font-bold text-zinc-500">Última {row.lastLap}</div>}
      </td>
      <td className="px-3 py-2 text-zinc-600">
        {index === 0 ? "—" : gap(row.time, leaderTime)}
        {row.pitStops && <div className="text-xs font-bold text-zinc-500">{row.pitStops} pits</div>}
      </td>
      <td className="px-3 py-2">
        {raceGroup ? (
          <div className="max-w-[260px]">
            <div className="flex flex-wrap items-center gap-1">
              <Badge tone={raceGroup.tone}>{formatRaceMessageType(raceGroup.latest.type)}</Badge>
              <Badge tone="gray">{raceGroup.messages.length} msg</Badge>
            </div>
            <div className="mt-1 text-xs font-bold leading-4 text-zinc-700">{truncateText(raceGroup.latest.translatedMessage, 105)}</div>
          </div>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
    </tr>
  );
}
function PhotoBox({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img src={src} alt={label} onError={() => setFailed(true)} className="h-32 w-full rounded-2xl bg-zinc-50 object-contain p-2 sm:h-40" />;
  return <div className="flex h-32 w-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 sm:h-40"><div className="text-center"><ImageIcon className="mx-auto mb-1" size={26} /><div className="text-xs font-bold">Sem foto</div></div></div>;
}

function DriverAvatar({ driver }: { driver: DriverCard }) {
  const [failed, setFailed] = useState(false);
  if (driver.avatar && !failed) {
    return <img src={driver.avatar} alt={driver.name} onError={() => setFailed(true)} className="h-12 w-12 rounded-2xl object-cover ring-1 ring-zinc-200" />;
  }
  const initials = driver.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
  return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-sm font-black text-zinc-500 ring-1 ring-zinc-200"><UserRound size={18} className="mr-0.5" />{initials}</div>;
}

export default function NurburgringCompanion() {
  const [active, setActive] = useState("agora");
  const [qRows, setQRows] = useState<QRow[]>(q1Seed);
  const [qualifyingRows, setQualifyingRows] = useState<QRow[]>(q1Seed);
  const [qualifyingFrozenAt, setQualifyingFrozenAt] = useState("");
  const [finalRows, setFinalRows] = useState<QRow[]>([]);
  const [finalSnapshotAt, setFinalSnapshotAt] = useState("");
  const [allCars, setAllCars] = useState<GridCar[]>(carSeed);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<Record<string, boolean>>({ "#80": true, "#3": true, "#911": true, "#1": true, "#99": true, "#64": true, "#67": true, "#300": true, "#632": true });
  const [phases, setPhases] = useState<Phase[]>(phasesSeed);
  const [raceEvents, setRaceEvents] = useState<RaceEvent[]>(raceEventsSeed);
  const [eventTitle, setEventTitle] = useState("");
  const [eventNote, setEventNote] = useState("");
  const [eventTag, setEventTag] = useState("Observação");
  const [poleGuess, setPoleGuess] = useState("#80 Mercedes-AMG Team RAVENOL");
  const [now, setNow] = useState(Date.now());
  const [apiUrl, setApiUrl] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshSeconds, setRefreshSeconds] = useState(30);
  const [apiStatus, setApiStatus] = useState("manual");
  const [lastUpdated, setLastUpdated] = useState("");
  const [apiError, setApiError] = useState("");
  const [liveSearch, setLiveSearch] = useState("");
  const [liveClassFilter, setLiveClassFilter] = useState("Todas");
  const [liveOnlyFavorites, setLiveOnlyFavorites] = useState(false);
  const [liveOnlyRaceControl, setLiveOnlyRaceControl] = useState(false);
  const [raceMessages, setRaceMessages] = useState<RaceControlMessage[]>([]);
  const [raceMessageFilter, setRaceMessageFilter] = useState("Tudo");
  const [raceUnreadCount, setRaceUnreadCount] = useState(0);
  const [raceNotice, setRaceNotice] = useState<RaceControlMessage | null>(null);
  const liveWsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const manualDisconnectRef = useRef(false);
  const autoConnectStartedRef = useRef(false);
  const raceMessageKeysRef = useRef<Set<string>>(new Set());
  const [liveEventId, setLiveEventId] = useState("50");
  const [liveStatus, setLiveStatus] = useState("desconectado");
  const [liveMeta, setLiveMeta] = useState({ session: "", heat: "", track: "", cars: 0, updated: "" });
  const [liveTrackState, setLiveTrackState] = useState("—");
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [carSearch, setCarSearch] = useState("");
  const [carClassFilter, setCarClassFilter] = useState("Todos");
  const [carGroupFilter, setCarGroupFilter] = useState("Todos");
  const [carsPage, setCarsPage] = useState(1);
  const [expandedCar, setExpandedCar] = useState<string | null>(null);
  const carsPerPage = 6;
  const [driverSearch, setDriverSearch] = useState("");
  const [driverFilter, setDriverFilter] = useState("Todos");
  const [driversPage, setDriversPage] = useState(1);
  const driverGroupsPerPage = 6;
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [autoConnectLive, setAutoConnectLive] = useState(true);
  const [autoReconnectLive, setAutoReconnectLive] = useState(true);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(AUTH_TOKEN_KEY) || "");
  const [authUser, setAuthUser] = useState<AppUser | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [syncStatus, setSyncStatus] = useState(authToken ? "carregando conta" : "local");
  const [remoteReady, setRemoteReady] = useState(false);
  const saveRemoteTimerRef = useRef<number | null>(null);

  const applyPersistedState = (parsed: any) => {
    setQRows(parsed.qRows || q1Seed);
    setQualifyingRows(parsed.qualifyingRows || parsed.qRows || q1Seed);
    setQualifyingFrozenAt(parsed.qualifyingFrozenAt || "");
    setFinalRows(parsed.finalRows || []);
    setFinalSnapshotAt(parsed.finalSnapshotAt || "");
    setAllCars(parsed.allCars || carSeed);
    setChecked(parsed.checked || {});
    setFavorites(parsed.favorites || { "#80": true, "#3": true, "#911": true, "#1": true, "#99": true, "#64": true, "#67": true, "#300": true, "#632": true });
    setPhases(parsed.phases || phasesSeed);
    setRaceEvents(parsed.raceEvents || raceEventsSeed);
    setPoleGuess(parsed.poleGuess || "#80 Mercedes-AMG Team RAVENOL");
    setApiUrl(parsed.apiUrl || "");
    setAutoRefresh(parsed.autoRefresh || false);
    setRefreshSeconds(parsed.refreshSeconds || 30);
    setLiveEventId(parsed.liveEventId || "50");
    setAutoConnectLive(parsed.autoConnectLive ?? true);
    setAutoReconnectLive(parsed.autoReconnectLive ?? true);
  };

  const persistedState = useMemo(() => ({
    qRows,
    qualifyingRows,
    qualifyingFrozenAt,
    finalRows,
    finalSnapshotAt,
    allCars,
    checked,
    favorites,
    phases,
    raceEvents,
    poleGuess,
    apiUrl,
    autoRefresh,
    refreshSeconds,
    liveEventId,
    autoConnectLive,
    autoReconnectLive
  }), [qRows, qualifyingRows, qualifyingFrozenAt, finalRows, finalSnapshotAt, allCars, checked, favorites, phases, raceEvents, poleGuess, apiUrl, autoRefresh, refreshSeconds, liveEventId, autoConnectLive, autoReconnectLive]);

  const apiRequest = async (path: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");
    if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  };

  const saveAuthSession = (token: string, user: AppUser) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setRemoteReady(false);
    setAuthToken(token);
    setAuthUser(user);
    setAuthError("");
  };

  useEffect(() => {
    try {
      if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "true") setIsAdmin(true);
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) applyPersistedState(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedState));
  }, [persistedState]);

  useEffect(() => {
    let cancelled = false;
    if (!authToken) {
      setAuthUser(null);
      setRemoteReady(false);
      setSyncStatus("local");
      return;
    }

    const loadRemoteState = async () => {
      try {
        setSyncStatus("carregando conta");
        const me = await apiRequest("/api/me");
        if (cancelled) return;
        setAuthUser(me.user);

        const remote = await apiRequest("/api/state");
        if (cancelled) return;
        if (remote.state && Object.keys(remote.state).length > 0) {
          applyPersistedState(remote.state);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remote.state));
        }
        setRemoteReady(true);
        setSyncStatus("sincronizado");
      } catch (err: any) {
        if (cancelled) return;
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setAuthToken("");
        setAuthUser(null);
        setRemoteReady(false);
        setSyncStatus("local");
        setAuthError(String(err.message || err));
      }
    };

    loadRemoteState();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !authUser || !remoteReady) return;
    if (saveRemoteTimerRef.current) window.clearTimeout(saveRemoteTimerRef.current);
    setSyncStatus("salvando");
    saveRemoteTimerRef.current = window.setTimeout(async () => {
      try {
        await apiRequest("/api/state", { method: "PUT", body: JSON.stringify({ state: persistedState }) });
        setSyncStatus(`salvo ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
      } catch (err: any) {
        setSyncStatus("erro ao salvar");
        setAuthError(String(err.message || err));
      }
    }, 1800);
    return () => {
      if (saveRemoteTimerRef.current) window.clearTimeout(saveRemoteTimerRef.current);
    };
  }, [persistedState, authToken, authUser, remoteReady]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const openRaceControl = () => setActive("racecontrol");
    window.addEventListener("open-race-control", openRaceControl);
    return () => window.removeEventListener("open-race-control", openRaceControl);
  }, []);

  useEffect(() => {
    if (active === "racecontrol") setRaceUnreadCount(0);
  }, [active]);

  useEffect(() => {
    if (!isAdmin && active === "auto") setActive("agora");
  }, [isAdmin, active]);

  const fetchApi = async () => {
    if (!apiUrl.trim()) {
      setApiError("Cole uma URL de API/JSON primeiro.");
      setApiStatus("erro");
      return;
    }
    try {
      setApiStatus("buscando");
      setApiError("");
      const res = await fetch(apiUrl.trim(), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rows = Array.isArray(json) ? json : json.results || json.classification || json.rows || json.data || [];
      if (!Array.isArray(rows) || !rows.length) throw new Error("Não encontrei lista em results/classification/rows/data.");
      setQRows(rows.map((r: any, idx: number) => ({
        pos: Number(r.pos ?? r.position ?? idx + 1),
        num: String(r.num ?? r.number ?? r.carNumber ?? r.no ?? "#"),
        team: String(r.team ?? r.entrant ?? r.name ?? ""),
        car: String(r.car ?? r.vehicle ?? r.model ?? ""),
        time: String(r.time ?? r.bestLap ?? r.best_lap ?? r.lapTime ?? ""),
        cls: String(r.cls ?? r.class ?? r.category ?? "")
      })));
      setApiStatus("ok");
      setLastUpdated(new Date().toLocaleTimeString("pt-BR"));
    } catch (err: any) {
      setApiStatus("erro");
      setApiError(String(err.message || err));
    }
  };

  const normalizeLiveRows = (result: any[]) => {
    const rows: QRow[] = [];
    result.forEach((r: any, idx: number) => {
      const numRaw = String(r.STNR ?? r.NUMBER ?? r.STARTINGNO ?? r.NO ?? r.num ?? "").trim();
      const cleanNum = numRaw.replace(/^#/, "").trim();
      if (!cleanNum || cleanNum === "-" || cleanNum.toLowerCase() === "null" || cleanNum.toLowerCase() === "undefined") return;
      const best = String(r.FASTESTLAP ?? r.BESTLAP ?? r.BESTTIME ?? r.time ?? "").trim();
      const last = String(r.LASTLAPTIME ?? r.LASTLAP ?? r.lastLap ?? "").trim();
      const pitState = String(r.TPST ?? r.PITSTATE ?? r.PITSTATUS ?? "").trim();
      const position = Number(r.POSITION ?? r.POS ?? r.RANK ?? idx + 1);
      rows.push({
        pos: Number.isFinite(position) && position > 0 ? position : idx + 1,
        num: `#${cleanNum}`,
        team: String(r.TEAM ?? r.NAME ?? r.ENTRANT ?? r.DRIVER ?? "").trim(),
        car: String(r.CAR ?? r.VEHICLE ?? r.MODEL ?? "").trim(),
        time: best || last || "",
        cls: String(r.CLASSNAME ?? r.CLASS ?? r.CUP ?? "").trim(),
        change: Number(r.CHG ?? r.change ?? 0),
        pitStops: String(r.PITSTOPCOUNT ?? r.PITS ?? "").trim(),
        pitState,
        lastLap: last
      });
    });
    return rows;
  };

  const addLiveLog = (text: string) => {
    const stamp = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLiveLog((old) => [`${stamp} — ${text}`, ...old].slice(0, 8));
  };

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const connectLiveTiming = () => {
    try {
      clearReconnectTimer();
      manualDisconnectRef.current = false;
      if (liveWsRef.current) {
        liveWsRef.current.onclose = null;
        liveWsRef.current.close();
      }
      setLiveStatus("conectando");
      setApiError("");
      const ws = new WebSocket("wss://livetiming.azurewebsites.net/");
      liveWsRef.current = ws;

      ws.onopen = () => {
        setLiveStatus("conectado");
        setApiStatus("ok");
        addLiveLog(`WebSocket conectado no evento ${liveEventId}`);
        ws.send(JSON.stringify({ eventId: liveEventId, eventPid: [0, 3, 4, 7], clientLocalTime: Date.now() }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (String(data.PID) === "0") {
            const result = Array.isArray(data.RESULT) ? data.RESULT : [];
            if (result.length) {
              const parsed = normalizeLiveRows(result);
              if (!parsed.length) {
                addLiveLog(`Pacote principal recebido sem carros válidos: ${result.length} linhas`);
                return;
              }
              setQRows(parsed);
              setLastUpdated(new Date().toLocaleTimeString("pt-BR"));
              setLiveMeta({
                session: String(data.SESSION ?? ""),
                heat: String(data.HEAT ?? data.SESSIONNAME ?? ""),
                track: String(data.TRACKNAME ?? ""),
                cars: parsed.length,
                updated: new Date().toLocaleTimeString("pt-BR")
              });
              addLiveLog(`Pacote principal recebido: ${parsed.length} carros válidos`);
            }
          }
          if (String(data.PID) === "3" && Array.isArray(data.MESSAGES)) {
            const normalized = normalizeRaceMessages(data.MESSAGES);
            const previousKeys = raceMessageKeysRef.current;
            const newMessages = normalized.filter((msg) => !previousKeys.has(getRaceMessageKey(msg)));
            raceMessageKeysRef.current = new Set(normalized.map(getRaceMessageKey));
            setRaceMessages(normalized);

            if (normalized[0]) setRaceNotice(normalized[0]);
            if (previousKeys.size > 0 && newMessages.length > 0) {
              setRaceUnreadCount((count) => count + newMessages.length);
              setRaceNotice(newMessages[0]);
              addLiveLog(`Nova mensagem Race Control: ${truncateText(newMessages[0].message, 80)}`);
            }

            addLiveLog(`Race Control recebido: ${normalized.length} mensagens`);
          }
          if (String(data.PID) === "4") {
            const state = String(data.TRACKSTATE ?? data.STATE ?? data.FLAG ?? data.TEXT ?? "Atualizado");
            setLiveTrackState(state);
            addLiveLog(`Estado da pista: ${state}`);
          }
        } catch {
          addLiveLog("Mensagem bruta recebida do WebSocket");
        }
      };

      ws.onerror = () => {
        setLiveStatus("erro");
        setApiStatus("erro");
        setApiError("Erro na conexão WebSocket do live timing.");
        addLiveLog("Erro no WebSocket");
      };

      ws.onclose = (e) => {
        setLiveStatus("desconectado");
        addLiveLog(`WebSocket fechado: ${e.code || "sem código"}`);
        if (!manualDisconnectRef.current && autoReconnectLive) {
          addLiveLog("Tentando reconectar em 5s...");
          clearReconnectTimer();
          reconnectTimerRef.current = window.setTimeout(() => {
            connectLiveTiming();
          }, 5000);
        }
      };
    } catch (err: any) {
      setLiveStatus("erro");
      setApiError(String(err.message || err));
    }
  };

  const disconnectLiveTiming = () => {
    manualDisconnectRef.current = true;
    clearReconnectTimer();
    if (liveWsRef.current) {
      liveWsRef.current.close();
      liveWsRef.current = null;
    }
    setLiveStatus("desconectado");
    addLiveLog("Conexão encerrada manualmente");
  };

  useEffect(() => {
    if (!autoConnectLive || autoConnectStartedRef.current) return;
    const id = window.setTimeout(() => {
      if (autoConnectStartedRef.current) return;
      autoConnectStartedRef.current = true;
      connectLiveTiming();
    }, 350);
    return () => window.clearTimeout(id);
  }, [autoConnectLive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      manualDisconnectRef.current = true;
      clearReconnectTimer();
      if (liveWsRef.current) liveWsRef.current.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefresh || !apiUrl.trim()) return;
    fetchApi();
    const id = setInterval(fetchApi, Math.max(10, Number(refreshSeconds) || 30) * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, apiUrl, refreshSeconds]);

  const sortedQ = useMemo(() => sortTimingRows(qRows), [qRows]);
  const qualifyingSortedRows = useMemo(() => sortTimingRows(qualifyingRows), [qualifyingRows]);
  const finalSortedRows = useMemo(() => sortTimingRows(finalRows), [finalRows]);
  const bestQualifyingTime = qualifyingSortedRows.find((r) => r.time)?.time || "";
  const raceStart = new Date(RACE_START_BRT).getTime();
  const raceEnd = new Date(RACE_END_BRT).getTime();
  const raceStarted = now >= raceStart;
  const raceFinished = now >= raceEnd;
  const qualifyingFreezeTime = new Date(QUALIFYING_FREEZE_BRT).getTime();
  const qualifyingFrozen = now >= qualifyingFreezeTime;
  const raceProgress = Math.min(100, Math.max(0, ((now - raceStart) / (raceEnd - raceStart)) * 100));

  useEffect(() => {
    if (!qualifyingFrozen && sortedQ.length) {
      setQualifyingRows(sortedQ.map(({ _idx, sec, livePos, ...row }: any) => row));
      setQualifyingFrozenAt("");
    }
    if (qualifyingFrozen && !qualifyingFrozenAt) {
      setQualifyingFrozenAt(new Date().toLocaleString("pt-BR"));
    }
  }, [qualifyingFrozen, qualifyingFrozenAt, sortedQ]);

  useEffect(() => {
    if (raceFinished && !finalSnapshotAt && sortedQ.length) {
      setFinalRows(sortedQ.map(({ _idx, sec, livePos, ...row }: any) => row));
      setFinalSnapshotAt(new Date().toLocaleString("pt-BR"));
    }
  }, [raceFinished, finalSnapshotAt, sortedQ]);
  const currentSession = useMemo(() => agenda.find((a) => getAgendaStatus(a, now) === "Agora") || null, [now]);
  const nextSession = useMemo(() => agenda.find((a) => new Date(a.iso).getTime() > now) || agenda[agenda.length - 1], [now]);
  const agendaWithStatus = useMemo(() => agenda.map((a) => ({ ...a, status: getAgendaStatus(a, now) })), [now]);
  const classOptions = useMemo(() => ["Todos", ...Array.from(new Set(allCars.map((c) => c.cls).filter(Boolean))).sort()], [allCars]);
  const groupOptions = useMemo(() => ["Todos", ...Array.from(new Set(allCars.map((c) => c.group).filter(Boolean))).sort()], [allCars]);
  const filteredCars = useMemo(() => {
    const q = carSearch.trim().toLowerCase();
    return allCars.filter((c) => {
      const okClass = carClassFilter === "Todos" || c.cls === carClassFilter;
      const okGroup = carGroupFilter === "Todos" || c.group === carGroupFilter;
      const hay = `${c.num} ${c.cls} ${c.team} ${c.car} ${c.why} ${c.group}`.toLowerCase();
      return okClass && okGroup && (!q || hay.includes(q));
    });
  }, [allCars, carSearch, carClassFilter, carGroupFilter]);
  useEffect(() => {
    setCarsPage(1);
  }, [carSearch, carClassFilter, carGroupFilter]);
  const totalCarPages = Math.max(1, Math.ceil(filteredCars.length / carsPerPage));
  const paginatedCars = useMemo(() => {
    const start = (carsPage - 1) * carsPerPage;
    return filteredCars.slice(start, start + carsPerPage);
  }, [filteredCars, carsPage]);
  const carPageStart = filteredCars.length ? (carsPage - 1) * carsPerPage + 1 : 0;
  const carPageEnd = Math.min(carsPage * carsPerPage, filteredCars.length);
  const checkedCount = allCars.filter((c) => checked[c.num]).length;
  const favoriteCars = useMemo(() => allCars.filter((c) => favorites[c.num]), [allCars, favorites]);
  const liveByNum = useMemo(() => {
    const map: Record<string, QRow & { pos?: number }> = {};
    sortedQ.forEach((row) => {
      const key = String(row.num || "").trim();
      if (!key) return;
      map[key.startsWith("#") ? key : `#${key}`] = row;
    });
    return map;
  }, [sortedQ]);

  const liveClasses = useMemo(() => ["Todas", ...Array.from(new Set(sortedQ.map((r) => r.cls).filter(Boolean))).sort()], [sortedQ]);
  const raceMessagesByNum = useMemo(() => {
    const map: Record<string, RaceControlMessage[]> = {};
    raceMessages.forEach((message) => {
      if (!message.carNum) return;
      map[message.carNum] = [...(map[message.carNum] || []), message];
    });
    return map;
  }, [raceMessages]);
  const filteredLiveRows = useMemo(() => {
    const q = liveSearch.trim().toLowerCase();
    return sortedQ.filter((r) => {
      const okClass = liveClassFilter === "Todas" || r.cls === liveClassFilter;
      const okFavorite = !liveOnlyFavorites || !!favorites[r.num];
      const okRaceControl = !liveOnlyRaceControl || !!raceMessagesByNum[r.num]?.length;
      const hay = `${r.pos} ${r.num} ${r.team} ${r.car} ${r.cls} ${r.time}`.toLowerCase();
      return okClass && okFavorite && okRaceControl && (!q || hay.includes(q));
    });
  }, [sortedQ, liveSearch, liveClassFilter, liveOnlyFavorites, liveOnlyRaceControl, favorites, raceMessagesByNum]);
  const filteredLeaderTime = useMemo(() => filteredLiveRows.find((row) => row.time)?.time || "", [filteredLiveRows]);

  const liveLeadersByClass = useMemo(() => {
    const map = new Map<string, QRow & { pos?: number }>();
    sortedQ.forEach((r) => {
      const key = r.cls || "Sem classe";
      if (!map.has(key)) map.set(key, r);
    });
    return Array.from(map.entries()).map(([cls, row]) => ({ cls, row })).sort((a, b) => Number(a.row.pos || 999) - Number(b.row.pos || 999));
  }, [sortedQ]);
  const raceMessageTypes = useMemo(() => ["Tudo", ...Array.from(new Set(raceMessages.map((m) => m.type)))], [raceMessages]);
  const filteredRaceMessages = useMemo(() => {
    if (raceMessageFilter === "Tudo") return raceMessages;
    return raceMessages.filter((m) => m.type === raceMessageFilter);
  }, [raceMessages, raceMessageFilter]);
  const raceMessageGroups = useMemo(() => {
    const map = new Map<string, { messages: RaceControlMessage[]; firstIndex: number }>();

    raceMessages.forEach((message, index) => {
      const num = message.carNum.trim();
      if (!num) return;
      const current = map.get(num);
      if (current) current.messages.push(message);
      else map.set(num, { messages: [message], firstIndex: index });
    });

    return Array.from(map.entries())
      .map(([num, group]) => {
        const messages = group.messages;
        const tone = getRaceGroupTone(messages);
        return {
          num,
          messages,
          latest: messages[0],
          car: allCars.find((car) => car.num === num),
          live: liveByNum[num],
          tone,
          urgent: messages.some((message) => isUrgentRaceMessage(message.type)),
          firstIndex: group.firstIndex
        };
      })
      .sort((a, b) => getRaceGroupRank(b) - getRaceGroupRank(a) || a.firstIndex - b.firstIndex);
  }, [raceMessages, allCars, liveByNum]);
  const raceAttention = useMemo(() => raceMessageGroups.filter((group) => group.urgent).slice(0, 12), [raceMessageGroups]);
  const raceGroupByNum = useMemo(() => {
    const map: Record<string, RaceControlGroup> = {};
    raceMessageGroups.forEach((group) => {
      map[group.num] = group;
    });
    return map;
  }, [raceMessageGroups]);
  const raceStats = useMemo(() => ({
    cars: raceMessageGroups.length,
    attention: raceAttention.length,
    penalties: raceMessages.filter((message) => message.type === "penalty" || message.type === "technical").length,
    investigations: raceMessages.filter((message) => message.type === "investigation" || message.type === "code60").length
  }), [raceMessageGroups.length, raceAttention.length, raceMessages]);
  const favoriteCockpitCars = useMemo(() => {
    return [...favoriteCars].sort((a, b) => {
      const aGroup = raceGroupByNum[a.num];
      const bGroup = raceGroupByNum[b.num];
      const groupDelta = (bGroup ? getRaceGroupRank(bGroup) : 0) - (aGroup ? getRaceGroupRank(aGroup) : 0);
      if (groupDelta) return groupDelta;
      return Number(liveByNum[a.num]?.pos || 9999) - Number(liveByNum[b.num]?.pos || 9999);
    });
  }, [favoriteCars, raceGroupByNum, liveByNum]);
  const favoriteAlertCount = useMemo(() => favoriteCars.filter((car) => raceGroupByNum[car.num]?.urgent).length, [favoriteCars, raceGroupByNum]);
  const driversByCarNum = useMemo(() => {
    const map: Record<string, DriverCard[]> = {};
    allDriversSeed.forEach((driver) => {
      const nums = String(driver.carNum).split("/").map((part) => part.trim()).filter(Boolean);
      nums.forEach((num) => {
        const normalized = num.startsWith("#") ? num : `#${num}`;
        map[normalized] = [...(map[normalized] || []), driver];
      });
    });
    return map;
  }, []);
  const driverTeamGroups = useMemo<DriverTeamGroup[]>(() => {
    return allCars.map((car) => ({ key: `${car.num}-${car.team}`, car, drivers: driversByCarNum[car.num] || [] }));
  }, [allCars, driversByCarNum]);
  const driverTeams = useMemo(() => ["Todos", ...Array.from(new Set(driverTeamGroups.map((group) => group.car.team))).sort()], [driverTeamGroups]);
  const filteredDriverGroups = useMemo(() => {
    const q = driverSearch.trim().toLowerCase();
    return driverTeamGroups.filter((group) => {
      const okTeam = driverFilter === "Todos" || group.car.team === driverFilter;
      const knownDrivers = group.drivers.length ? group.drivers.map((p) => `${p.name} ${p.nationality} ${p.role} ${p.won24h} ${p.history} ${p.watch}`).join(" ") : "pilotos da equipe lista completa";
      const hay = `${group.car.num} ${group.car.cls} ${group.car.team} ${group.car.car} ${knownDrivers}`.toLowerCase();
      return okTeam && (!q || hay.includes(q));
    });
  }, [driverSearch, driverFilter, driverTeamGroups]);
  useEffect(() => {
    setDriversPage(1);
  }, [driverSearch, driverFilter]);
  const totalDriverPages = Math.max(1, Math.ceil(filteredDriverGroups.length / driverGroupsPerPage));
  const paginatedDriverGroups = useMemo(() => {
    const start = (driversPage - 1) * driverGroupsPerPage;
    return filteredDriverGroups.slice(start, start + driverGroupsPerPage);
  }, [filteredDriverGroups, driversPage]);
  const driverPageStart = filteredDriverGroups.length ? (driversPage - 1) * driverGroupsPerPage + 1 : 0;
  const driverPageEnd = Math.min(driversPage * driverGroupsPerPage, filteredDriverGroups.length);

  const visibleTabGroups = useMemo(() => {
    return tabGroups
      .map((group) => ({
        ...group,
        tabs: group.tabs.filter((tab) => isAdmin || tab.id !== "auto")
      }))
      .filter((group) => group.tabs.length > 0);
  }, [isAdmin]);
  const mobileTabs = useMemo(() => visibleTabGroups.flatMap((group) => group.tabs), [visibleTabGroups]);
  const mobileDockTabs = useMemo(() => {
    const ids = ["agora", "racewatch", "live", "racecontrol", "carros"];
    return ids.map((id) => tabs.find((tab) => tab.id === id)).filter((tab): tab is (typeof tabs)[number] => Boolean(tab));
  }, []);

  const finalResultRows = finalSortedRows.length ? finalSortedRows : sortedQ;
  const finalWinner = finalResultRows[0];
  const finalFavoriteRows = useMemo(() => {
    return favoriteCars
      .map((car) => ({ car, result: finalResultRows.find((row) => row.num === car.num) }))
      .sort((a, b) => Number(a.result?.pos || 9999) - Number(b.result?.pos || 9999));
  }, [favoriteCars, finalResultRows]);
  const automaticRaceSummary = useMemo(() => {
    if (!raceFinished) return "Resumo final será liberado automaticamente quando a corrida terminar.";
    const winnerText = finalWinner ? `Vencedor provisório: ${finalWinner.num} — ${finalWinner.team} (${finalWinner.car}), P${finalWinner.pos}.` : "Ainda não há resultado final salvo.";
    const bestFavorite = finalFavoriteRows.find((item) => item.result);
    const favoriteText = bestFavorite?.result ? `Melhor favorito acompanhado: ${bestFavorite.car.num} — ${bestFavorite.car.team}, terminou em P${bestFavorite.result.pos}.` : "Nenhum favorito apareceu no snapshot final.";
    const rcText = `Race Control registrou ${raceMessages.length} mensagens no app, com ${raceStats.attention} carros em atenção.`;
    return `${winnerText} ${favoriteText} ${rcText}`;
  }, [raceFinished, finalWinner, finalFavoriteRows, raceMessages.length, raceStats.attention]);

  const resetAll = () => {
    setQRows(q1Seed);
    setQualifyingRows(q1Seed);
    setQualifyingFrozenAt("");
    setFinalRows([]);
    setFinalSnapshotAt("");
    setAllCars(carSeed);
    setChecked({});
    setFavorites({ "#80": true, "#3": true, "#911": true, "#1": true, "#99": true, "#64": true, "#67": true, "#300": true, "#632": true });
    setPhases(phasesSeed);
    setRaceEvents(raceEventsSeed);
    setPoleGuess("#80 Mercedes-AMG Team RAVENOL");
    setAutoRefresh(false);
    setApiStatus("manual");
    setApiError("");
    setLiveOnlyFavorites(false);
    setLiveOnlyRaceControl(false);
    setRaceMessages([]);
    setRaceUnreadCount(0);
    setRaceNotice(null);
    setLiveEventId("50");
    setAutoConnectLive(true);
    setAutoReconnectLive(true);
    setLiveLog([]);
    raceMessageKeysRef.current = new Set();
  };

  const submitAuth = async () => {
    try {
      setAuthError("");
      setSyncStatus(authMode === "register" ? "criando conta" : "entrando");
      const data = await apiRequest(authMode === "register" ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: authEmail, password: authPassword, displayName: authName })
      });
      saveAuthSession(data.token, data.user);
      setAuthPassword("");
      setSyncStatus("sincronizado");
    } catch (err: any) {
      setSyncStatus(authToken ? syncStatus : "local");
      setAuthError(String(err.message || err));
    }
  };

  const logoutUser = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken("");
    setAuthUser(null);
    setRemoteReady(false);
    setAuthPassword("");
    setAuthError("");
    setSyncStatus("local");
  };

  const loginAdmin = () => {
    if (adminPassword.trim() !== ADMIN_PASSWORD) {
      setAdminError("Senha inválida. Tente novamente.");
      return;
    }
    sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    setIsAdmin(true);
    setShowAdminLogin(false);
    setAdminPassword("");
    setAdminError("");
  };

  const logoutAdmin = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAdmin(false);
    setShowAdminLogin(false);
    setAdminPassword("");
    setAdminError("");
    if (active === "auto") setActive("agora");
  };

  const protectedResetAll = () => {
    if (!isAdmin) {
      setAdminError("Entre como admin para resetar os dados do app.");
      setShowAdminLogin(true);
      return;
    }
    setResetConfirmOpen(true);
    setResetConfirmText("");
  };

  const confirmProtectedReset = () => {
    if (resetConfirmText.trim().toUpperCase() !== "RESETAR") return;
    resetAll();
    setResetConfirmOpen(false);
    setResetConfirmText("");
  };

  const copyFinalSummary = async () => {
    const text = automaticRaceSummary;
    try {
      await navigator.clipboard.writeText(text);
      setSummaryCopied(true);
      window.setTimeout(() => setSummaryCopied(false), 1800);
    } catch {
      setSummaryCopied(false);
      addLiveLog("Não foi possível copiar o resumo automaticamente.");
    }
  };

  const setCarChecked = (num: string, value: boolean) => setChecked((old) => ({ ...old, [num]: value }));
  const toggleFavorite = (num: string) => setFavorites((old) => ({ ...old, [num]: !old[num] }));
  const addRaceEvent = () => {
    if (!eventTitle.trim() && !eventNote.trim()) return;
    const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setRaceEvents((old) => [{ id: Date.now(), time, title: eventTitle.trim() || "Observação", note: eventNote.trim(), tag: eventTag }, ...old]);
    setEventTitle("");
    setEventNote("");
  };

  return <div className="min-h-screen bg-zinc-100 p-3 pb-24 text-zinc-950 sm:p-4 md:p-8 md:pb-8"><div className="mx-auto max-w-7xl">
    <header className="mb-5 overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[1.55fr_.45fr]">
        <div className="relative overflow-hidden bg-zinc-950 p-6 text-white md:p-8">
          <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-red-700/25 blur-3xl" />
          <div className="relative z-10">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <Badge tone="red">24h Nürburgring 2026</Badge>
              <Badge>Companion interativo</Badge>
              <Badge tone="amber">Horários em Brasília</Badge>
            </div>
            <div className="max-w-4xl">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-400">Painel de acompanhamento</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl md:text-6xl">Race Control de bolso</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300 md:text-base">Classificação ao vivo, Race Control, favoritos, checklist, cronômetros e grid completo em uma tela limpa para acompanhar a prova sem ficar caçando informação.</p>
            </div>
          </div>
        </div>
        <aside className="border-t border-zinc-200 bg-zinc-50 p-6 lg:border-l lg:border-t-0 md:p-8">
          <div className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">Palpite de pole provisória</div>
          <Input value={poleGuess} onChange={setPoleGuess} placeholder="Ex: #80 Mercedes-AMG" className="mt-3 bg-white" />
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-700 p-4 text-white shadow-sm">
            <div className="text-xs font-black uppercase tracking-wider text-red-100">Palpite atual</div>
            <div className="mt-1 text-lg font-black leading-6">{poleGuess}</div>
          </div>
        </aside>
      </div>
    </header>

    <section className="mb-5 hidden rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm md:block">
      <div className="grid gap-3 xl:grid-cols-[1fr_.85fr_.9fr_.55fr_140px]">
        {visibleTabGroups.map((group) => (
          <div key={group.title} className="rounded-3xl bg-zinc-50 p-3">
            <div className="mb-2 px-2 text-[11px] font-black uppercase tracking-widest text-zinc-500">{group.title}</div>
            <div className="flex flex-wrap gap-2">
              {group.tabs.map((t) => {
                const Icon = t.icon;
                const selected = active === t.id;
                return <button key={t.id} onClick={() => setActive(t.id)} className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black shadow-sm transition ${selected ? "bg-red-700 text-white shadow-red-700/20" : "bg-white text-zinc-700 hover:-translate-y-0.5 hover:bg-zinc-950 hover:text-white"}`}><Icon size={17} /> {t.label}</button>;
              })}
            </div>
          </div>
        ))}
        <div className="flex items-end justify-end rounded-3xl bg-zinc-50 p-3">
          {isAdmin ? (
            <div className="grid w-full gap-2">
              <button onClick={protectedResetAll} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-600 shadow-sm hover:bg-red-700 hover:text-white"><RotateCcw size={16} /> Resetar</button>
              <button onClick={logoutAdmin} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-zinc-800"><LogOut size={16} /> Sair admin</button>
            </div>
          ) : (
            <button onClick={() => { setShowAdminLogin((value) => !value); setAdminError(""); }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-600 shadow-sm hover:bg-zinc-950 hover:text-white"><ShieldCheck size={16} /> Admin</button>
          )}
        </div>
      </div>
    </section>

    <section className="sticky top-2 z-40 mb-5 rounded-3xl border border-zinc-200 bg-white/95 p-3 shadow-sm backdrop-blur md:hidden">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Navegação</div>
        <Badge tone={liveStatus === "conectado" ? "green" : "gray"}>{liveStatus}</Badge>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {mobileTabs.map((t) => {
          const Icon = t.icon;
          const selected = active === t.id;
          return (
            <button key={t.id} onClick={() => setActive(t.id)} className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black shadow-sm transition ${selected ? "bg-red-700 text-white shadow-red-700/20" : "bg-zinc-100 text-zinc-700"}`}>
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
        {isAdmin ? (
          <button onClick={logoutAdmin} className="flex shrink-0 items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white shadow-sm">
            <LogOut size={16} /> Admin
          </button>
        ) : (
          <button onClick={() => { setShowAdminLogin((value) => !value); setAdminError(""); }} className="flex shrink-0 items-center gap-2 rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-black text-zinc-700 shadow-sm">
            <ShieldCheck size={16} /> Admin
          </button>
        )}
      </div>
    </section>

    {!isAdmin && showAdminLogin && (
      <section className="mb-6 rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px_130px] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-zinc-500"><LockKeyhole size={16} /> Modo Admin</div>
            <h2 className="mt-2 text-2xl font-black">Área protegida</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">Libera a aba Config, conexão operacional e o botão Resetar. A sessão fica salva só nesta aba do navegador.</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-black uppercase tracking-wider text-zinc-500">Senha admin</div>
            <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") loginAdmin(); }} placeholder="Digite a senha" className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-600" />
            {adminError && <div className="mt-2 text-sm font-bold text-red-700">{adminError}</div>}
          </div>
          <button onClick={loginAdmin} className="flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-red-800"><ShieldCheck size={17} /> Entrar</button>
        </div>
      </section>
    )}

    <section className="mb-6 rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
      {authUser ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-black uppercase tracking-widest text-zinc-500"><UserRound size={16} /> Conta sincronizada</div>
            <h2 className="mt-2 text-2xl font-black">{authUser.displayName || authUser.email}</h2>
            <p className="mt-1 text-sm text-zinc-600">Dados salvos por usuário no backend. Status: <b>{syncStatus}</b>.</p>
          </div>
          <button onClick={logoutUser} className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-zinc-800"><LogOut size={16} /> Sair da conta</button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_220px_240px_180px_130px] xl:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-zinc-500"><UserRound size={16} /> Conta do app</div>
            <h2 className="mt-2 text-2xl font-black">Salvar online por usuário</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">Entre ou crie uma conta para sincronizar favoritos, checklist, snapshots, timeline e configurações.</p>
          </div>
          {authMode === "register" && (
            <div>
              <div className="mb-1 text-xs font-black uppercase tracking-wider text-zinc-500">Nome</div>
              <input value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Seu nome" className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-600" />
            </div>
          )}
          <div>
            <div className="mb-1 text-xs font-black uppercase tracking-wider text-zinc-500">Email</div>
            <input value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="voce@email.com" className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-600" />
          </div>
          <div>
            <div className="mb-1 text-xs font-black uppercase tracking-wider text-zinc-500">Senha</div>
            <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitAuth(); }} placeholder="mín. 6 caracteres" className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-600" />
          </div>
          <button onClick={submitAuth} className="rounded-2xl bg-red-700 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-red-800">{authMode === "register" ? "Criar conta" : "Entrar"}</button>
          <button onClick={() => { setAuthMode(authMode === "register" ? "login" : "register"); setAuthError(""); }} className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-black text-zinc-700 hover:bg-zinc-950 hover:text-white">{authMode === "register" ? "Já tenho" : "Criar"}</button>
          {authError && <div className="xl:col-span-5 rounded-2xl bg-red-50 p-3 text-sm font-bold text-red-800">Erro: {authError}</div>}
        </div>
      )}
    </section>

    {resetConfirmOpen && (
      <section className="mb-6 rounded-[2rem] border border-red-200 bg-red-50 p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_260px_260px] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-red-700"><RotateCcw size={16} /> Confirmação de reset</div>
            <h2 className="mt-2 text-2xl font-black">Resetar dados locais do app?</h2>
            <p className="mt-1 text-sm leading-6 text-red-900">Isso limpa favoritos, checklist, snapshots, Race Control, logs e configurações salvas neste navegador. Para confirmar, digite <b>RESETAR</b>.</p>
          </div>
          <input value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmProtectedReset(); }} placeholder="Digite RESETAR" className="w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-black uppercase outline-none focus:border-red-700" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <button onClick={confirmProtectedReset} disabled={resetConfirmText.trim().toUpperCase() !== "RESETAR"} className={(resetConfirmText.trim().toUpperCase() === "RESETAR" ? "bg-red-700 text-white hover:bg-red-800" : "bg-zinc-200 text-zinc-400") + " rounded-2xl px-4 py-3 text-sm font-black"}>Confirmar reset</button>
            <button onClick={() => { setResetConfirmOpen(false); setResetConfirmText(""); }} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-700 shadow-sm hover:bg-zinc-950 hover:text-white">Cancelar</button>
          </div>
        </div>
      </section>
    )}

    {isAdmin && (
      <section className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><ShieldCheck size={18} /> Modo Admin ativo — Configurações e Resetar liberados nesta sessão.</div>
          <button onClick={logoutAdmin} className="rounded-2xl bg-white px-4 py-2 font-black text-emerald-900 shadow-sm hover:bg-emerald-900 hover:text-white">Logout</button>
        </div>
      </section>
    )}

    <section className="mb-6 grid gap-3 md:grid-cols-4">
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Tela ativa</div>
        <div className="mt-1 text-xl font-black">{tabs.find((t) => t.id === active)?.label || "Agora"}</div>
      </div>
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Live Timing</div>
        <div className="mt-2 flex items-center gap-2"><Badge tone={liveStatus === "conectado" ? "green" : liveStatus === "erro" ? "red" : "gray"}>{liveStatus}</Badge><span className="text-sm font-bold text-zinc-600">{liveMeta.updated || "sem atualização"}</span></div>
      </div>
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Próxima sessão</div>
        <div className="mt-1 text-xl font-black">{nextSession.day} {nextSession.br}</div>
        <div className="text-sm text-zinc-600">{nextSession.item}</div>
      </div>
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Race Control</div>
        <div className="mt-1 text-xl font-black">{raceMessages.length}</div>
        <div className="text-sm text-zinc-600">mensagens carregadas</div>
      </div>
    </section>

    {active === "agora" && <section className="space-y-5"><div className="grid gap-5 md:grid-cols-4"><StatBox title="Pulso da corrida" value={liveMeta.updated || new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} note={`Live Timing: ${liveStatus}`} tone={liveStatus === "conectado" ? "green" : "gray"} /><StatBox title="Sessão atual" value={currentSession ? `${currentSession.br}` : "—"} note={currentSession ? currentSession.item : "Nenhuma sessão em andamento"} tone={currentSession ? "red" : "gray"} /><StatBox title="Próxima sessão" value={`${nextSession.day} ${nextSession.br}`} note={nextSession.item} tone="amber" /><StatBox title={raceFinished ? "Corrida encerrada" : raceStarted ? "Tempo restante" : "Falta para a largada"} value={raceFinished ? "Final" : raceStarted ? formatDuration(raceEnd - now) : formatDuration(raceStart - now)} note={raceStarted && !raceFinished ? `Decorridos: ${formatDuration(now - raceStart)}` : "Sábado 10:00 BRT"} tone="green" /></div>{raceStarted && !raceFinished && <CardBox className="p-5"><div className="mb-2 flex items-center justify-between"><h2 className="text-xl font-black">Progresso das 24h</h2><Badge tone="red">{raceProgress.toFixed(1)}%</Badge></div><div className="h-4 overflow-hidden rounded-full bg-zinc-200"><div className="h-full bg-red-700" style={{ width: `${raceProgress}%` }} /></div></CardBox>}<CardBox className="p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Agenda rápida</h2><p className="mt-1 text-sm text-zinc-600">Status calculado pelo horário de Brasília: concluído, agora ou depois.</p></div><Badge tone="blue">BRT</Badge></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{agendaWithStatus.map((a, idx) => <div key={idx} className={`rounded-2xl border p-4 text-sm transition ${agendaCardClass(a.status)}`}><div className="mb-3 flex items-center justify-between gap-2"><Badge tone={agendaTone(a.status)}>{a.status}</Badge><Badge tone={a.tag === "Corrida" ? "red" : a.tag.includes("Q") ? "amber" : "gray"}>{a.tag}</Badge></div><div className="text-xs font-black uppercase tracking-wider text-zinc-500">{a.day}</div><div className="mt-1 text-2xl font-black">{a.br}</div><div className="mt-2 font-black">{a.item}</div><div className="mt-1 text-xs text-zinc-500">Duração aprox.: {a.durationMin >= 60 ? `${Math.floor(a.durationMin / 60)}h${a.durationMin % 60 ? ` ${a.durationMin % 60}min` : ""}` : `${a.durationMin}min`}</div></div>)}</div></CardBox></section>}

    {active === "racewatch" && (
      <section className="space-y-5">
        <CardBox className="overflow-hidden border-zinc-300">
          <div className="grid gap-0 xl:grid-cols-[1.25fr_.75fr]">
            <div className="bg-zinc-950 p-5 text-white md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge tone="red">Race Watch</Badge>
                    <Badge tone={liveStatus === "conectado" ? "green" : "gray"}>{liveStatus}</Badge>
                    {liveMeta.heat && <Badge tone="blue">{liveMeta.heat}</Badge>}
                  </div>
                  <h2 className="text-3xl font-black tracking-tight md:text-4xl">Cockpit principal</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
                    Tela para deixar aberta durante a corrida: favoritos no topo, alertas de Race Control, live timing e relógio regressivo oficial das 24h.
                  </p>
                </div>
                <div className="rounded-3xl bg-white/10 p-4 text-right">
                  <div className="text-xs font-black uppercase tracking-widest text-zinc-400">Relógio regressivo 24h</div>
                  <div className="mt-1 text-2xl font-black md:text-3xl">
                    {raceFinished ? "00d 00h 00m 00s" : raceStarted ? formatDuration(raceEnd - now) : "01d 00h 00m 00s"}
                  </div>
                  <div className="mt-1 text-xs font-bold text-zinc-400">
                    {raceFinished ? "Corrida encerrada" : raceStarted ? `Decorridos: ${formatDuration(now - raceStart)}` : "Começa a contar na largada"}
                  </div>
                </div>
              </div>
              {raceStarted && !raceFinished && <div className="mt-5"><div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400"><span>Progresso das 24h</span><span>{raceProgress.toFixed(1)}%</span></div><div className="h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-red-700" style={{ width: `${raceProgress}%` }} /></div></div>}
            </div>

            <div className="grid gap-3 bg-zinc-50 p-5 sm:grid-cols-2">
              <StatBox title="Favoritos" value={String(favoriteCars.length)} note={favoriteAlertCount ? `${favoriteAlertCount} com alerta RC` : "todos no radar"} tone={favoriteAlertCount ? "red" : "amber"} />
              <StatBox title="Race Control" value={String(raceStats.attention)} note="carros em atenção" tone={raceStats.attention ? "red" : "green"} />
              <StatBox title="Live Timing" value={String(sortedQ.length)} note={liveMeta.updated || "sem pacote"} tone="blue" />
              <StatBox title="Relógio 24h" value={raceFinished ? "00:00" : raceStarted ? formatDuration(raceEnd - now) : "24:00"} note={raceStarted ? "contagem regressiva ativa" : "aguardando largada"} tone="gray" />
            </div>
          </div>
        </CardBox>

        {raceFinished && (
          <CardBox className="border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex flex-wrap gap-2"><Badge tone="green">Pós-corrida</Badge><Badge tone="gray">snapshot final</Badge></div>
                <h2 className="text-2xl font-black">Resumo final automático</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-700">{automaticRaceSummary}</p>
                <button onClick={copyFinalSummary} className="mt-4 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-zinc-800">{summaryCopied ? "Resumo copiado" : "Copiar resumo final"}</button>
              </div>
              <div className="rounded-2xl bg-white p-4 text-right">
                <div className="text-xs font-black uppercase tracking-wider text-zinc-500">Snapshot salvo</div>
                <div className="mt-1 text-lg font-black">{finalSnapshotAt || "aguardando último pacote"}</div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <StatBox title="Vencedor provisório" value={finalWinner?.num || "—"} note={finalWinner ? `${finalWinner.team} · ${finalWinner.car}` : "sem dados finais"} tone="green" />
              <StatBox title="Carros no snapshot" value={String(finalResultRows.length)} note="último resultado salvo" tone="blue" />
              <StatBox title="Mensagens RC" value={String(raceMessages.length)} note="registradas no app" tone="amber" />
            </div>
          </CardBox>
        )}

        <CardBox className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">Favoritos no topo</h3>
              <p className="mt-1 text-sm text-zinc-600">Resumo rápido dos carros que vocês querem acompanhar sem abrir a tabela inteira.</p>
            </div>
            <Badge tone={favoriteAlertCount ? "red" : "green"}>{favoriteAlertCount ? `${favoriteAlertCount} precisam de atenção` : "sem alerta crítico"}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {favoriteCockpitCars.slice(0, 10).map((c) => {
              const live = liveByNum[c.num];
              const group = raceGroupByNum[c.num];
              const tone = group?.tone || "gray";
              return (
                <div key={c.num} className={`rounded-3xl border p-4 ${getRaceCardClass(tone)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-3xl font-black text-red-700">{c.num}</div>
                      <div className="mt-1 text-xs font-black uppercase tracking-wider text-zinc-500">{c.cls || "classe"}</div>
                    </div>
                    {live && <Badge tone="green">P{live.pos || "—"}</Badge>}
                  </div>
                  <div className="mt-3 min-h-[42px] text-sm font-black leading-5">{c.team}</div>
                  <div className="mt-1 truncate text-xs text-zinc-600">{c.car}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {live?.time && <Badge tone="dark">{live.time}</Badge>}
                    {group && <Badge tone={group.tone}>RC</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBox>

        <div className="grid gap-5 xl:grid-cols-[1.6fr_.8fr]">
          <CardBox className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 p-5">
              <div>
                <h2 className="text-2xl font-black">Tabela de acompanhamento</h2>
                <p className="mt-1 text-sm text-zinc-600">Favoritos ordenados por alerta de Race Control e posição ao vivo.</p>
              </div>
              <Badge tone="blue">live timing + Race Control</Badge>
            </div>
            <div className="grid gap-3 p-4 md:hidden">
              {favoriteCockpitCars.map((c) => {
                const live = liveByNum[c.num];
                const group = raceGroupByNum[c.num];
                const tone = group?.tone || "gray";

                return (
                  <div key={c.num + "-compact"} className={`rounded-2xl border p-4 ${getRaceCardClass(tone)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-2xl font-black text-red-700">{c.num}</div>
                        <div className="mt-1 text-sm font-black leading-5">{c.team}</div>
                        <div className="mt-1 text-xs text-zinc-600">{c.car}</div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge tone="amber">Favorito</Badge>
                        {live && <Badge tone="green">P{live.pos || "—"}</Badge>}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl bg-white/70 p-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Tempo</div>
                        <div className="mt-1 font-black">{live?.time || "sem tempo"}</div>
                      </div>
                      <div className="rounded-2xl bg-white/70 p-3">
                        <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Classe</div>
                        <div className="mt-1 font-black">{c.cls || live?.cls || "—"}</div>
                      </div>
                    </div>
                    {group ? (
                      <button onClick={() => setActive("racecontrol")} className="mt-3 w-full rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-black text-white">
                        {formatRaceMessageType(group.latest.type)} · ver RC
                      </button>
                    ) : (
                      <div className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-sm font-bold text-zinc-500">Sem alerta de Race Control</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-zinc-950 text-left text-white">
                  <tr>
                    <th className="px-3 py-3">Carro</th>
                    <th className="px-3 py-3">Equipe</th>
                    <th className="px-3 py-3">Live</th>
                    <th className="px-3 py-3">Race Control</th>
                  </tr>
                </thead>
                <tbody>
                  {favoriteCockpitCars.map((c) => {
                    const live = liveByNum[c.num];
                    const group = raceGroupByNum[c.num];
                    const tone = group?.tone || "gray";
                    const rowClass = tone === "red" ? "bg-red-50" : tone === "amber" ? "bg-amber-50" : tone === "green" ? "bg-emerald-50" : tone === "blue" ? "bg-blue-50" : "bg-white";

                    return (
                      <tr key={c.num} className={`${rowClass} border-b border-zinc-100 align-top`}>
                        <td className="px-3 py-3">
                          <div className="text-2xl font-black text-red-700">{c.num}</div>
                          <div className="mt-1 flex flex-wrap gap-1"><Badge>{c.cls || "—"}</Badge><Badge tone="amber">favorito</Badge></div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-black">{c.team}</div>
                          <div className="mt-1 text-xs text-zinc-600">{c.car}</div>
                        </td>
                        <td className="px-3 py-3">
                          {live ? <div><Badge tone="green">P{live.pos || "—"}</Badge><div className="mt-1 font-black">{live.time || "sem tempo"}</div><div className="text-xs text-zinc-500">{live.lastLap ? `Última: ${live.lastLap}` : live.cls}</div></div> : <span className="font-bold text-zinc-500">Sem dados</span>}
                        </td>
                        <td className="px-3 py-3">
                          {group ? <div><Badge tone={group.tone}>{formatRaceMessageType(group.latest.type)}</Badge><div className="mt-1 max-w-[360px] font-bold leading-5">{truncateText(group.latest.translatedMessage, 140)}</div><button onClick={() => setActive("racecontrol")} className="mt-2 text-xs font-black text-red-700">ver mensagens</button></div> : <span className="text-zinc-400">Sem alerta</span>}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBox>

          <div className="space-y-5">
            <CardBox className="p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-xl font-black">Race Control quente</h2>
                <Badge tone={raceAttention.length ? "red" : "green"}>{raceAttention.length} carros</Badge>
              </div>
              <div className="space-y-3">
                {raceAttention.length ? raceAttention.slice(0, 5).map((group) => <RaceControlGroupCard key={group.num} group={group} dense />) : <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-950">Nenhum alerta crítico no momento.</div>}
              </div>
            </CardBox>


          </div>
        </div>
      </section>
    )}

    {active === "live" && (
      <section className="space-y-5">
        <CardBox className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Live Timing</h2>
              <p className="mt-1 text-sm text-zinc-600">Tabela em tempo real via WebSocket, com filtros r?pidos para favoritos e carros citados pelo Race Control.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2"><Badge tone={apiStatus === "ok" ? "green" : "gray"}>{apiStatus === "ok" ? "conectado" : "manual"}</Badge><Badge tone="blue">{filteredLiveRows.length}/{sortedQ.length} carros</Badge>{raceUnreadCount > 0 && <Badge tone="red">{raceUnreadCount} RC novo</Badge>}</div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_200px_auto_auto]">
            <div className="relative"><Search className="absolute left-3 top-3 text-zinc-400" size={18} /><input value={liveSearch} onChange={(e) => setLiveSearch(e.target.value)} placeholder="Buscar número, equipe, carro, classe ou tempo..." className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-red-600" /></div>
            <select value={liveClassFilter} onChange={(e) => setLiveClassFilter(e.target.value)} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-600">{liveClasses.map((c) => <option key={c}>{c}</option>)}</select>
            <label className={(liveOnlyFavorites ? "border-red-200 bg-red-50 text-red-900" : "border-zinc-200 bg-white text-zinc-700") + " flex cursor-pointer items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black"}><input type="checkbox" checked={liveOnlyFavorites} onChange={(e) => setLiveOnlyFavorites(e.target.checked)} className="h-4 w-4 accent-red-700" />Favoritos</label>
            <label className={(liveOnlyRaceControl ? "border-red-200 bg-red-50 text-red-900" : "border-zinc-200 bg-white text-zinc-700") + " flex cursor-pointer items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black"}><input type="checkbox" checked={liveOnlyRaceControl} onChange={(e) => setLiveOnlyRaceControl(e.target.checked)} className="h-4 w-4 accent-red-700" />Com RC</label>
          </div>
        </CardBox>

        {raceNotice && <CardBox className="border-red-200 bg-red-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone={getRaceMessageTone(raceNotice.type)}>Race Control</Badge>{raceNotice.carNum && <span className="text-lg font-black text-red-700">{raceNotice.carNum}</span>}{raceNotice.time && <span className="text-sm font-bold text-zinc-500">{raceNotice.time}</span>}</div><div className="text-sm font-bold leading-5">{truncateText(raceNotice.translatedMessage, 220)}</div>{raceNotice.translatedMessage !== raceNotice.message && <div className="mt-1 text-xs font-semibold text-zinc-500">Original: {truncateText(raceNotice.message, 170)}</div>}</div><button onClick={() => setActive("racecontrol")} className="rounded-xl bg-zinc-950 px-3 py-2 text-sm font-black text-white">Ver mensagens</button></div></CardBox>}

        <div className="grid gap-5 md:grid-cols-4">
          <StatBox title="Carros no live" value={String(sortedQ.length)} note="linhas recebidas" tone="green" />
          <StatBox title="Filtrados" value={String(filteredLiveRows.length)} note={liveOnlyFavorites || liveOnlyRaceControl ? "filtros ativos" : "resultado atual"} tone="blue" />
          <StatBox title="Com Race Control" value={String(raceMessageGroups.length)} note={raceUnreadCount ? raceUnreadCount + " novas" : "sem novas"} tone={raceUnreadCount ? "red" : "amber"} />
          <StatBox title="Favoritos no live" value={String(sortedQ.filter((r) => favorites[r.num]).length)} note="marcados com ★" tone="amber" />
        </div>

        <div className="grid gap-3 md:hidden">
          {filteredLiveRows.map((r, idx) => {
            const group = raceGroupByNum[r.num];
            const positionChange = Number(r.change || 0);
            const hasPit = isPitState(r.pitState);
            const classTone = getLiveClassTone(r.cls);
            const isFavorite = !!favorites[r.num];
            const rowClass = `${getLiveRowBaseClass(idx, group, isFavorite)} ${getLiveClassAccent(r.cls)} border-l-4`;

            return (
              <div key={r.num + "-mobile-" + idx} className={`${rowClass} rounded-2xl border border-zinc-200 p-4 shadow-sm`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-2xl font-black">P{r.pos || idx + 1}</span>
                      {positionChange !== 0 && <Badge tone={positionChange > 0 ? "green" : "red"}>{positionChange > 0 ? "+" + positionChange : positionChange}</Badge>}
                      {isFavorite && <Badge tone="amber">Fav</Badge>}
                      {hasPit && <Badge tone="amber">PIT</Badge>}
                    </div>
                    <div className="mt-2 text-3xl font-black text-red-700">{r.num}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={classTone}>{r.cls || "—"}</Badge>
                    {group && <Badge tone={group.tone}>RC</Badge>}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="font-black leading-5">{r.team || "—"}</div>
                  <div className="mt-1 text-sm text-zinc-600">{r.car || "—"}</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-white/70 p-3">
                    <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Tempo</div>
                    <div className="mt-1 font-black">{r.time || "sem tempo"}</div>
                    {r.lastLap && <div className="mt-1 text-xs font-bold text-zinc-500">Última {r.lastLap}</div>}
                  </div>
                  <div className="rounded-2xl bg-white/70 p-3">
                    <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Gap</div>
                    <div className="mt-1 font-black">{idx === 0 ? "—" : gap(r.time, filteredLeaderTime)}</div>
                    {r.pitStops && <div className="mt-1 text-xs font-bold text-zinc-500">{r.pitStops} pits</div>}
                  </div>
                </div>
                {group && (
                  <button onClick={() => setActive("racecontrol")} className="mt-3 w-full rounded-2xl bg-zinc-950 px-4 py-3 text-left text-sm font-black text-white">
                    {formatRaceMessageType(group.latest.type)} · {truncateText(group.latest.translatedMessage, 86)}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <CardBox className="hidden overflow-hidden md:block">
          <div className="max-h-[720px] overflow-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-950 text-left text-white">
                <tr><th className="px-3 py-3">Pos</th><th className="px-3 py-3">Nº</th><th className="px-3 py-3">Equipe/Piloto</th><th className="px-3 py-3">Carro</th><th className="px-3 py-3">Classe</th><th className="px-3 py-3">Tempo</th><th className="px-3 py-3">Gap</th><th className="px-3 py-3">Race Control</th></tr>
              </thead>
              <tbody>{filteredLiveRows.map((r, idx) => <LiveTimingRow key={r.num + "-" + idx} row={r} index={idx} leaderTime={filteredLeaderTime} raceGroup={raceGroupByNum[r.num]} isFavorite={!!favorites[r.num]} />)}</tbody>
            </table>
          </div>
        </CardBox>

        <CardBox className="p-5"><h2 className="text-2xl font-black">Líderes por classe</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{liveLeadersByClass.slice(0, 12).map(({ cls, row }) => <div key={cls} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"><div className="flex items-center justify-between"><Badge tone={getLiveClassTone(cls)}>{cls}</Badge><div className="font-black">P{row.pos || "—"}</div></div><div className="mt-2 text-lg font-black">{row.num}</div><div className="text-sm font-bold">{row.team}</div><div className="text-xs text-zinc-600">{row.car}</div><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-sm font-black text-red-700">{row.time || "sem tempo"}</span>{favorites[row.num] && <Badge tone="amber">★</Badge>}{raceGroupByNum[row.num] && <Badge tone={raceGroupByNum[row.num].tone}>RC</Badge>}</div></div>)}</div></CardBox>
      </section>
    )}

    {active === "racecontrol" && (
      <section className="space-y-5">
        <CardBox className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black">Race Control</h2>
              <p className="mt-1 text-sm text-zinc-600">Mensagens oficiais da direção de prova: investigações, Code 60, bandeira técnica, punições e decisões dos comissários.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={apiStatus === "ok" ? "green" : "gray"}>{apiStatus === "ok" ? "conectado" : "manual"}</Badge>
              <Badge tone="blue">{filteredRaceMessages.length}/{raceMessages.length} mensagens</Badge>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {raceMessageTypes.map((type) => (
              <button key={type} onClick={() => setRaceMessageFilter(type)} className={`rounded-full px-4 py-2 text-sm font-black ${raceMessageFilter === type ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                {formatRaceMessageType(type)}
              </button>
            ))}
          </div>
        </CardBox>

        <div className="grid gap-5 md:grid-cols-4">
          <StatBox title="Atenção agora" value={String(raceStats.attention)} note="carros com alerta" tone={raceStats.attention ? "red" : "green"} />
          <StatBox title="Carros citados" value={String(raceStats.cars)} note="agrupados por número" tone="blue" />
          <StatBox title="Punições/técnico" value={String(raceStats.penalties)} note="ação crítica" tone={raceStats.penalties ? "red" : "gray"} />
          <StatBox title="Investigações" value={String(raceStats.investigations)} note="inclui Code 60" tone={raceStats.investigations ? "amber" : "gray"} />
        </div>

        {raceAttention.length > 0 && (
          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-black">Atenção agora</h3>
              <Badge tone="red">{raceAttention.length} carros</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {raceAttention.slice(0, 9).map((group) => <RaceControlGroupCard key={group.num} group={group} />)}
            </div>
          </section>
        )}

        {raceMessageGroups.length > 0 && (
          <CardBox className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-black">Agrupado por carro</h3>
              <Badge tone="blue">{raceMessageGroups.length} carros com mensagem</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {raceMessageGroups.slice(0, 12).map((group) => <RaceControlGroupCard key={group.num} group={group} dense />)}
            </div>
          </CardBox>
        )}

        <CardBox className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">Mensagens completas</h3>
              <p className="mt-1 text-sm text-zinc-600">Lista geral do Race Control.</p>
            </div>
            <Badge tone="blue">{filteredRaceMessages.length} mensagens</Badge>
          </div>

          {filteredRaceMessages.length === 0 ? (
            <div className="rounded-2xl bg-zinc-50 p-5">
              <p className="text-sm text-zinc-600">Nenhuma mensagem recebida ainda. Conecte na aba Config ou aguarde o próximo pacote do Race Control.</p>
            </div>
          ) : (
            <div className="max-h-[620px] space-y-3 overflow-y-auto pr-2">
              {filteredRaceMessages.map((msg, idx) => {
                const car = msg.carNum ? allCars.find((c) => c.num === msg.carNum) : undefined;

                return (
                  <div key={`${msg.time}-${msg.message}-${idx}`} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={getRaceMessageTone(msg.type)}>{formatRaceMessageType(msg.type)}</Badge>
                          {msg.time && <span className="text-sm font-bold text-zinc-500">{msg.time}</span>}
                          {msg.carNum && <span className="text-lg font-black text-red-700">{msg.carNum}</span>}
                        </div>
                        <div className="text-base font-bold">{msg.translatedMessage}</div>
                        {msg.translatedMessage !== msg.message && <div className="text-xs font-semibold text-zinc-500">Original: {msg.message}</div>}
                        {car && (
                          <div className="rounded-2xl bg-white p-3 text-sm shadow-sm">
                            <div className="font-black">{car.team}</div>
                            <div className="text-zinc-600">{car.car} • {car.cls}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBox>
      </section>
    )}

    {active === "quali" && (
      <section className="space-y-5">
        <CardBox className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge tone={qualifyingFrozen ? "green" : "amber"}>{qualifyingFrozen ? "Classificação congelada" : "Atualizando pelo Live Timing"}</Badge>
                <Badge tone="blue">Freeze: 15/05 10:00 BRT</Badge>
                {liveMeta.heat && <Badge tone="gray">{liveMeta.heat}</Badge>}
              </div>
              <h2 className="text-2xl font-black">GRID &gt; Qualifying automático</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">
                Esta tela acompanha o Live Timing durante as sessões de classificação e congela automaticamente após o horário final do quali.
                Assim, quando a corrida começar, ela vira a referência do grid/classificação sem ser alterada pelo ritmo de corrida.
              </p>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-4 text-right">
              <div className="text-xs font-black uppercase tracking-wider text-zinc-500">Último snapshot</div>
              <div className="mt-1 text-lg font-black">{qualifyingFrozenAt || liveMeta.updated || lastUpdated || "—"}</div>
            </div>
          </div>
        </CardBox>

        <div className="grid gap-5 md:grid-cols-4">
          <StatBox title="Carros no quali" value={String(qualifyingSortedRows.length)} note={qualifyingFrozen ? "resultado congelado" : "espelhando live timing"} tone={qualifyingFrozen ? "green" : "amber"} />
          <StatBox title="Pole provisória" value={qualifyingSortedRows[0]?.num || "—"} note={qualifyingSortedRows[0]?.team || "sem dados"} tone="red" />
          <StatBox title="Melhor tempo" value={qualifyingSortedRows[0]?.time || "—"} note={qualifyingSortedRows[0]?.car || "—"} tone="blue" />
          <StatBox title="Status" value={qualifyingFrozen ? "Congelado" : "Ao vivo"} note={qualifyingFrozen ? "não muda mais sozinho" : "aguardando fim do quali"} tone={qualifyingFrozen ? "green" : "amber"} />
        </div>

        <CardBox className="overflow-hidden">
          <div className="max-h-[68vh] overflow-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-950 text-left text-white">
                <tr>
                  <th className="px-3 py-3">Pos</th>
                  <th className="px-3 py-3">Nº</th>
                  <th className="px-3 py-3">Classe</th>
                  <th className="px-3 py-3">Equipe</th>
                  <th className="px-3 py-3">Carro</th>
                  <th className="px-3 py-3">Tempo</th>
                  <th className="px-3 py-3">Gap</th>
                </tr>
              </thead>
              <tbody>
                {qualifyingSortedRows.map((row, idx) => (
                  <tr key={`${row.num}-${idx}`} className={`${idx === 0 ? "bg-amber-50" : idx % 2 ? "bg-white" : "bg-zinc-50"} border-b border-zinc-100`}>
                    <td className="px-3 py-3 font-black">P{row.pos || idx + 1}</td>
                    <td className="px-3 py-3 font-black text-red-700">{row.num}</td>
                    <td className="px-3 py-3"><Badge tone={String(row.cls || "").includes("SP 9") || String(row.cls || "").includes("SP9") ? "red" : "gray"}>{row.cls || "—"}</Badge></td>
                    <td className="px-3 py-3 font-bold">{row.team || "—"}</td>
                    <td className="px-3 py-3 text-zinc-700">{row.car || "—"}</td>
                    <td className="px-3 py-3 font-black">{row.time || "—"}</td>
                    <td className="px-3 py-3 text-zinc-600">{idx === 0 ? "—" : gap(row.time, bestQualifyingTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBox>
      </section>
    )}

    {active === "auto" && isAdmin && (
      <section className="space-y-5">
        <CardBox className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Wifi className="text-red-700" size={22} />
                <h2 className="text-2xl font-black">Configurações</h2>
              </div>
              <p className="max-w-3xl text-sm leading-6 text-zinc-600">
                Central operacional do app: conexão WebSocket, Event ID, logs, JSON manual e status da integração.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={liveStatus === "conectado" ? "green" : liveStatus === "erro" ? "red" : liveStatus === "conectando" ? "amber" : "gray"}>{liveStatus}</Badge>
              <Badge tone={apiStatus === "ok" ? "green" : apiStatus === "erro" ? "red" : apiStatus === "buscando" ? "amber" : "gray"}>{apiStatus}</Badge>
            </div>
          </div>
        </CardBox>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <CardBox className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">Live Timing WebSocket</h3>
                <p className="mt-1 text-sm text-zinc-600">Conecta em wss://livetiming.azurewebsites.net/ e assina eventPid [0,3,4,7].</p>
              </div>
              <Badge tone={liveStatus === "conectado" ? "green" : liveStatus === "erro" ? "red" : liveStatus === "conectando" ? "amber" : "gray"}>{liveStatus}</Badge>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-black text-zinc-700">
                <input type="checkbox" checked={autoConnectLive} onChange={(e) => setAutoConnectLive(e.target.checked)} className="h-5 w-5 accent-red-700" />
                Auto conectar ao abrir o app
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-black text-zinc-700">
                <input type="checkbox" checked={autoReconnectLive} onChange={(e) => setAutoReconnectLive(e.target.checked)} className="h-5 w-5 accent-red-700" />
                Reconectar se cair
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-[160px_1fr]">
              <div>
                <div className="mb-1 text-xs font-black uppercase tracking-wider text-zinc-500">Event ID</div>
                <Input value={liveEventId} onChange={setLiveEventId} placeholder="50" />
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                <div><b>Evento:</b> {liveMeta.heat || "—"}</div>
                <div className="mt-1 text-zinc-600">Sessão: {liveMeta.session || "—"} • Pista: {liveMeta.track || "—"}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button onClick={connectLiveTiming} className="flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-red-800">
                <Wifi size={17} /> Conectar
              </button>
              <button onClick={disconnectLiveTiming} className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-zinc-800">
                <WifiOff size={17} /> Desconectar
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatBox title="Carros" value={String(liveMeta.cars || 0)} note="RESULT / PID 0" tone="blue" />
              <StatBox title="Race Control" value={String(raceMessages.length)} note="mensagens PID 3" tone={raceMessages.length ? "red" : "green"} />
              <StatBox title="Pista" value={liveTrackState} note="TRACKSTATE / PID 4" tone="amber" />
              <StatBox title="Último pacote" value={liveMeta.updated || lastUpdated || "—"} note="horário local" />
            </div>
          </CardBox>

          <CardBox className="p-5">
            <h3 className="text-xl font-black">JSON manual / fallback</h3>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              Use só se tivermos um endpoint próprio. O WebSocket continua sendo a fonte principal para o live timing.
            </p>

            <div className="mt-4">
              <div className="mb-1 text-xs font-black uppercase tracking-wider text-zinc-500">URL JSON</div>
              <Input value={apiUrl} onChange={setApiUrl} placeholder="https://seu-endpoint.com/timing.json" />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px]">
              <label className="flex items-center gap-3 rounded-2xl bg-zinc-50 p-4 text-sm font-bold">
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="h-5 w-5 accent-red-700" />
                Atualizar JSON automaticamente
              </label>
              <Input value={String(refreshSeconds)} onChange={(v) => setRefreshSeconds(Number(v) || 30)} />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={fetchApi} className="flex items-center gap-2 rounded-2xl bg-red-700 px-4 py-3 text-sm font-black text-white">
                <RefreshCcw size={16} /> Buscar JSON agora
              </button>
              <a href="https://www.24h-rennen.de/en/live-en/" target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white">
                <ExternalLink size={16} /> Live oficial
              </a>
            </div>

            <div className="mt-4 rounded-2xl bg-zinc-50 p-4 text-sm">
              <div className="flex items-center gap-2 font-black">
                {apiStatus === "ok" ? <Wifi size={18} className="text-emerald-700" /> : apiStatus === "erro" ? <WifiOff size={18} className="text-red-700" /> : <Timer size={18} className="text-zinc-600" />}
                {apiStatus === "ok" ? "JSON conectado" : apiStatus === "buscando" ? "Buscando JSON..." : apiStatus === "erro" ? "Erro no JSON" : "JSON em segundo plano"}
              </div>
              <p className="mt-2 text-zinc-600">Última atualização: {lastUpdated || "ainda não buscou"}</p>
              {apiError && <div className="mt-3 rounded-xl bg-red-50 p-3 font-semibold text-red-800">Erro: {apiError}</div>}
            </div>
          </CardBox>
        </div>

        <CardBox className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-black">Log da conexão</h3>
            <Badge tone={liveLog.length ? "blue" : "gray"}>{liveLog.length} registros</Badge>
          </div>
          <div className="max-h-72 overflow-auto rounded-2xl bg-zinc-950 p-4 font-mono text-xs text-zinc-100">
            {liveLog.length ? liveLog.map((l, i) => <div key={i} className="border-b border-white/10 py-1 last:border-b-0">{l}</div>) : <div className="text-zinc-400">Nenhum evento ainda.</div>}
          </div>
        </CardBox>
      </section>
    )}

    {active === "carros" && (
      <section className="space-y-5">
        <CardBox className="p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px]">
            <div className="relative"><Search className="absolute left-3 top-3 text-zinc-400" size={18} /><input value={carSearch} onChange={(e) => setCarSearch(e.target.value)} placeholder="Buscar por número, equipe, carro, classe..." className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-red-600" /></div>
            <select value={carClassFilter} onChange={(e) => setCarClassFilter(e.target.value)} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-600">{classOptions.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={carGroupFilter} onChange={(e) => setCarGroupFilter(e.target.value)} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-600">{groupOptions.map((g) => <option key={g}>{g}</option>)}</select>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-600"><Badge tone="red">{filteredCars.length} carros filtrados</Badge><Badge tone="amber">{favoriteCars.length} favoritos</Badge><Badge tone="blue">6 por página</Badge><Badge tone={raceStats.attention ? "red" : "green"}>{raceStats.attention} alertas RC</Badge></div>
        </CardBox>

        <CardBox className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-600">Mostrando <span className="font-black text-zinc-950">{carPageStart}</span> a <span className="font-black text-zinc-950">{carPageEnd}</span> de <span className="font-black text-zinc-950">{filteredCars.length}</span> carros</div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setCarsPage((p) => Math.max(1, p - 1))} disabled={carsPage <= 1} className={(carsPage <= 1 ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 text-white hover:bg-zinc-800") + " rounded-2xl px-4 py-2 text-sm font-black"}>← Anterior</button>
              <div className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-black text-zinc-700">Página {carsPage} de {totalCarPages}</div>
              <button onClick={() => setCarsPage((p) => Math.min(totalCarPages, p + 1))} disabled={carsPage >= totalCarPages} className={(carsPage >= totalCarPages ? "bg-zinc-100 text-zinc-400" : "bg-red-700 text-white hover:bg-red-800") + " rounded-2xl px-4 py-2 text-sm font-black"}>Próxima →</button>
            </div>
          </div>
        </CardBox>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paginatedCars.map((c) => {
            const live = liveByNum[c.num];
            const group = raceGroupByNum[c.num];
            const drivers = driversByCarNum[c.num] || [];
            const isExpanded = expandedCar === c.num;
            const borderClass = group ? (group.tone === "red" ? "border-red-300" : group.tone === "amber" ? "border-amber-300" : "border-blue-300") : "";

            return (
              <CardBox key={c.num + "-" + c.team} className={"overflow-hidden transition " + borderClass}>
                <div className="p-4"><div className="relative"><PhotoBox src={c.photo} label={c.num + " " + c.car} /><button onClick={() => toggleFavorite(c.num)} className={(favorites[c.num] ? "bg-amber-400 text-zinc-950" : "bg-white/90 text-zinc-500") + " absolute right-2 top-2 rounded-full p-2 shadow"} title="Favoritar"><Star size={18} fill={favorites[c.num] ? "currentColor" : "none"} /></button></div></div>
                <div className="flex items-center justify-between border-y border-zinc-100 bg-zinc-50 p-4"><div className="text-3xl font-black">{c.num}</div><div className="flex flex-wrap justify-end gap-2"><Badge tone={c.group === "Favorito" ? "red" : c.group === "Surpresa" ? "amber" : c.group === "Personagem" ? "green" : "gray"}>{c.group}</Badge><Badge>{c.cls || "—"}</Badge>{group && <Badge tone={group.tone}>RC</Badge>}</div></div>
                <div className="p-4">
                  <div className="font-black">{c.team}</div>
                  <div className="mt-1 text-sm text-zinc-600">{c.car}</div>
                  <p className="mt-3 text-sm leading-6">{c.why}</p>
                  <div className={(live ? "bg-emerald-50 text-emerald-950" : "bg-zinc-50 text-zinc-500") + " mt-4 rounded-2xl p-3 text-sm"}><div className="text-[10px] font-black uppercase tracking-wider">Live timing</div>{live ? <div className="mt-1 flex flex-wrap items-center gap-2"><Badge tone="green">P{live.pos || "—"}</Badge><span className="font-black">{live.time || "sem tempo"}</span><span className="text-xs">{live.cls || c.cls}</span></div> : <div className="mt-1 font-bold">Sem dados nesta sessão</div>}</div>
                  {group && <div className={(group.tone === "red" ? "bg-red-50 text-red-950" : group.tone === "amber" ? "bg-amber-50 text-amber-950" : "bg-blue-50 text-blue-950") + " mt-3 rounded-2xl p-3 text-sm"}><div className="flex flex-wrap items-center gap-2"><Badge tone={group.tone}>{formatRaceMessageType(group.latest.type)}</Badge><span className="text-xs font-black">{group.messages.length} msg</span></div><div className="mt-2 font-bold leading-5">{truncateText(group.latest.translatedMessage, 150)}</div><button onClick={() => setActive("racecontrol")} className="mt-2 text-xs font-black text-red-700">Ver Race Control</button></div>}
                  <button onClick={() => setExpandedCar((current) => current === c.num ? null : c.num)} className="mt-4 flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-black text-zinc-700 hover:bg-zinc-50"><span>Pilotos / equipe</span>{isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button>
                  {isExpanded && <div className="mt-3 rounded-2xl bg-zinc-50 p-3"><div className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-500">Pilotos cadastrados</div>{drivers.length ? <div className="space-y-2">{drivers.map((driver) => <div key={driver.name} className="flex items-center gap-3 rounded-xl bg-white p-2"><DriverAvatar driver={driver} /><div><div className="text-sm font-black">{driver.name}</div><div className="text-xs text-zinc-600">{driver.nationality} • {driver.role}</div></div></div>)}</div> : <div className="rounded-xl bg-white p-3 text-sm font-bold text-zinc-500">Pilotos ainda não encontrados na lista importada. Mantive o carro/equipe para consulta rápida.</div>}</div>}
                </div>
              </CardBox>
            );
          })}
        </div>
      </section>
    )}

    {active === "pilotos" && (
      <section className="space-y-5">
        <CardBox className="p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <div className="relative"><Search className="absolute left-3 top-3 text-zinc-400" size={18} /><input value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} placeholder="Buscar por piloto, equipe, carro, número ou histórico..." className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-red-600" /></div>
            <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-600">{driverTeams.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2"><Badge tone="red">{filteredDriverGroups.length} equipes/carros filtrados</Badge><Badge tone="amber">{allDriversSeed.length} pilotos cadastrados</Badge><Badge tone="blue">6 cards por página</Badge></div>
        </CardBox>

        <CardBox className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-600">Mostrando <span className="font-black text-zinc-950">{driverPageStart}</span> a <span className="font-black text-zinc-950">{driverPageEnd}</span> de <span className="font-black text-zinc-950">{filteredDriverGroups.length}</span> carros/equipes</div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setDriversPage((p) => Math.max(1, p - 1))} disabled={driversPage <= 1} className={(driversPage <= 1 ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 text-white hover:bg-zinc-800") + " rounded-2xl px-4 py-2 text-sm font-black"}>← Anterior</button>
              <div className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-black text-zinc-700">Página {driversPage} de {totalDriverPages}</div>
              <button onClick={() => setDriversPage((p) => Math.min(totalDriverPages, p + 1))} disabled={driversPage >= totalDriverPages} className={(driversPage >= totalDriverPages ? "bg-zinc-100 text-zinc-400" : "bg-red-700 text-white hover:bg-red-800") + " rounded-2xl px-4 py-2 text-sm font-black"}>Próxima →</button>
            </div>
          </div>
        </CardBox>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paginatedDriverGroups.map((group) => {
            const live = liveByNum[group.car.num];
            const rc = raceGroupByNum[group.car.num];
            return <CardBox key={group.key} className="overflow-hidden">
              <div className="border-b border-zinc-100 bg-zinc-950 p-5 text-white">
                <div className="flex items-start justify-between gap-3"><div><div className="text-2xl font-black">{group.car.num}</div><div className="mt-1 text-sm text-zinc-300">{group.car.team}</div></div><div className="flex flex-wrap justify-end gap-2"><Badge tone="red">{group.car.cls}</Badge>{live && <Badge tone="green">P{live.pos || "—"}</Badge>}{rc && <Badge tone={rc.tone}>RC</Badge>}</div></div>
                <div className="mt-3 text-sm text-zinc-300">{group.car.car}</div>
              </div>
              <div className="space-y-3 p-5">
                {group.drivers.length ? group.drivers.map((p) => <div key={`${p.name}-${p.carNum}`} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"><div className="flex items-start gap-3"><DriverAvatar driver={p} /><div className="min-w-0 flex-1"><div className="font-black">{p.name}</div><div className="mt-1 text-xs font-bold text-zinc-500">{p.nationality} • {p.role}</div><div className="mt-2"><Badge tone={p.won24h.toLowerCase().includes("já venceu") ? "green" : "gray"}>{p.won24h}</Badge></div></div></div><div className="mt-3 text-sm font-black text-red-700">Mini histórico</div><p className="mt-1 text-sm leading-6 text-zinc-700">{p.history}</p><div className="mt-3 text-sm font-black text-zinc-900">Por que acompanhar</div><p className="mt-1 text-sm leading-6 text-zinc-700">{p.watch}</p></div>) : <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-center"><div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-zinc-400"><UserRound size={26} /></div><div className="font-black">Pilotos ainda não cadastrados</div><p className="mt-2 text-sm leading-6 text-zinc-600">Este carro está na lista completa, mas ainda não tem pilotos com mini histórico no app. Quando tivermos os nomes, o card já está preparado.</p></div>}
              </div>
            </CardBox>;
          })}
        </div>
      </section>
    )}

    {active === "checklist" && <CardBox className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Caça aos carros</h2><p className="mt-1 text-sm text-zinc-600">Quando marcar, o card fica verde de confirmado.</p></div><Badge tone="green">{checkedCount}/{allCars.length} vistos</Badge></div><div className="mt-5 grid gap-3 md:grid-cols-2">{allCars.map((car) => { const isChecked = !!checked[car.num]; return <label key={car.num} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${isChecked ? "border-emerald-500 bg-emerald-50 text-emerald-950" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}><input type="checkbox" checked={isChecked} onChange={(e) => setCarChecked(car.num, e.target.checked)} className="h-5 w-5 accent-emerald-700" /><div className="flex-1"><div className="font-black">{car.num} — {car.car}</div><div className="text-sm opacity-75">{car.team}</div></div>{isChecked ? <Badge tone="green">Confirmado</Badge> : <Badge>Pendente</Badge>}</label>; })}</div></CardBox>}

    {active === "placar" && <CardBox className="p-5"><h2 className="text-2xl font-black">Placar por fases</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-sm"><thead><tr className="text-left text-xs uppercase text-zinc-500"><th>Fase</th><th>Líder geral</th><th>Surpresa</th><th>Observação</th></tr></thead><tbody>{phases.map((p, idx) => <tr key={p.phase} className="bg-white shadow-sm"><td className="rounded-l-2xl px-3 py-2 font-black">{p.phase}</td><td className="py-2"><Input value={p.leader} onChange={(v) => setPhases((rows) => rows.map((r, i) => i === idx ? { ...r, leader: v } : r))} /></td><td className="py-2"><Input value={p.surprise} onChange={(v) => setPhases((rows) => rows.map((r, i) => i === idx ? { ...r, surprise: v } : r))} /></td><td className="rounded-r-2xl py-2 pr-2"><Input value={p.note} onChange={(v) => setPhases((rows) => rows.map((r, i) => i === idx ? { ...r, note: v } : r))} /></td></tr>)}</tbody></table></div></CardBox>}

    {active === "timeline" && <CardBox className="p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Timeline da corrida</h2><p className="mt-1 text-sm text-zinc-600">Use para registrar chuva, pits, acidentes, Code 60, abandono e momentos legais.</p></div><Badge tone="red">{raceEvents.length} eventos</Badge></div><div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_150px]"><Input value={eventTitle} onChange={setEventTitle} placeholder="Título do evento" /><Input value={eventNote} onChange={setEventNote} placeholder="Observação" /><select value={eventTag} onChange={(e) => setEventTag(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-bold"><option>Observação</option><option>Incidente</option><option>Pit</option><option>Chuva</option><option>Code 60</option><option>Ultrapassagem</option><option>Abandono</option></select><button onClick={addRaceEvent} className="flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 py-3 text-sm font-black text-white"><Plus size={17} />Adicionar</button></div><div className="mt-5 space-y-3">{raceEvents.map((e) => <div key={e.id} className="grid gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 md:grid-cols-[100px_120px_1fr_40px]"><div className="font-black">{e.time}</div><div><Badge tone={e.tag === "Incidente" || e.tag === "Abandono" ? "red" : e.tag === "Chuva" || e.tag === "Code 60" ? "amber" : "gray"}>{e.tag}</Badge></div><div><div className="font-black">{e.title}</div>{e.note && <p className="mt-1 text-sm text-zinc-600">{e.note}</p>}</div><button onClick={() => setRaceEvents((old) => old.filter((x) => x.id !== e.id))} className="rounded-xl bg-white p-2 text-zinc-500 hover:text-red-700"><Trash2 size={17} /></button></div>)}</div></CardBox>}

    {active === "refs" && <CardBox className="p-5"><h2 className="text-2xl font-black">Referência de tempos</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="bg-zinc-900 text-left text-white"><tr><th className="p-3">Ano</th><th>Sessão</th><th>Mais rápido</th><th>Melhor tempo</th><th>P10</th><th>Janela</th><th>Nota</th></tr></thead><tbody>{references.map((r) => <tr key={r.year} className="border-b border-zinc-100"><td className="p-3 font-black">{r.year}</td><td>{r.session}</td><td>{r.p1}</td><td className="font-black text-red-700">{r.best}</td><td>{r.p10}</td><td>{r.window}</td><td>{r.note}</td></tr>)}</tbody></table></div></CardBox>}

    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 px-2 py-2 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {mobileDockTabs.map((t) => {
          const Icon = t.icon;
          const selected = active === t.id;
          return (
            <button key={t.id} onClick={() => setActive(t.id)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-black ${selected ? "bg-red-700 text-white" : "text-zinc-600"}`}>
              <Icon size={18} />
              <span className="max-w-full truncate">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  </div></div>;
}
