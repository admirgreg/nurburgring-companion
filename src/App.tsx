import React, { useEffect, useMemo, useRef, useState } from "react";
import { Trophy, Clock, Car, ListChecks, BarChart3, Flag, RotateCcw, Wifi, WifiOff, RefreshCcw, Timer, Search, Image as ImageIcon, ExternalLink, Star, AlertTriangle, Plus, Trash2, Activity } from "lucide-react";

const STORAGE_KEY = "nurburgring-2026-companion-v6-race-watch";
const RACE_START_BRT = "2026-05-16T10:00:00-03:00";
const RACE_END_BRT = "2026-05-17T10:00:00-03:00";

type QRow = { pos?: number; num: string; team: string; car: string; time: string; cls: string; change?: number; pitStops?: string; pitState?: string; lastLap?: string };
type GridCar = { num: string; cls: string; team: string; car: string; why: string; group: string; photo: string };
type Phase = { phase: string; leader: string; surprise: string; note: string };
type DriverCard = { name: string; nationality: string; carNum: string; team: string; car: string; role: string; won24h: string; history: string; watch: string };
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

const statusOptions = ["Normal", "No pit", "Em recuperação", "Problema", "Abandonou", "Atacando", "Defendendo"];

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

function getManualStatusTone(status: string) {
  if (status === "Abandonou" || status === "Problema") return "red";
  if (status === "No pit" || status === "Em recuperação" || status === "Defendendo") return "amber";
  if (status === "Atacando") return "green";
  return "gray";
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
  if (src && !failed) return <img src={src} alt={label} onError={() => setFailed(true)} className="h-28 w-full rounded-2xl object-contain bg-zinc-50" />;
  return <div className="flex h-28 w-full items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400"><div className="text-center"><ImageIcon className="mx-auto mb-1" size={26} /><div className="text-xs font-bold">Sem foto</div></div></div>;
}

export default function NurburgringCompanion() {
  const [active, setActive] = useState("agora");
  const [qRows, setQRows] = useState<QRow[]>(q1Seed);
  const [allCars, setAllCars] = useState<GridCar[]>(carSeed);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [favorites, setFavorites] = useState<Record<string, boolean>>({ "#80": true, "#3": true, "#911": true, "#1": true, "#99": true, "#64": true, "#67": true, "#300": true, "#632": true });
  const [carStatus, setCarStatus] = useState<Record<string, string>>({});
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
  const [driverSearch, setDriverSearch] = useState("");
  const [driverFilter, setDriverFilter] = useState("Todos");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setQRows(parsed.qRows || q1Seed);
        setAllCars(parsed.allCars || carSeed);
        setChecked(parsed.checked || {});
        setFavorites(parsed.favorites || { "#80": true, "#3": true, "#911": true, "#1": true, "#99": true, "#64": true, "#67": true, "#300": true, "#632": true });
        setCarStatus(parsed.carStatus || {});
        setPhases(parsed.phases || phasesSeed);
        setRaceEvents(parsed.raceEvents || raceEventsSeed);
        setPoleGuess(parsed.poleGuess || "#80 Mercedes-AMG Team RAVENOL");
        setApiUrl(parsed.apiUrl || "");
        setAutoRefresh(parsed.autoRefresh || false);
        setRefreshSeconds(parsed.refreshSeconds || 30);
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ qRows, allCars, checked, favorites, carStatus, phases, raceEvents, poleGuess, apiUrl, autoRefresh, refreshSeconds }));
  }, [qRows, allCars, checked, favorites, carStatus, phases, raceEvents, poleGuess, apiUrl, autoRefresh, refreshSeconds]);

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

  const connectLiveTiming = () => {
    try {
      if (liveWsRef.current) liveWsRef.current.close();
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
      };
    } catch (err: any) {
      setLiveStatus("erro");
      setApiError(String(err.message || err));
    }
  };

  const disconnectLiveTiming = () => {
    if (liveWsRef.current) {
      liveWsRef.current.close();
      liveWsRef.current = null;
    }
    setLiveStatus("desconectado");
    addLiveLog("Conexão encerrada manualmente");
  };

  useEffect(() => {
    if (autoConnectStartedRef.current) return;
    const id = window.setTimeout(() => {
      if (autoConnectStartedRef.current) return;
      autoConnectStartedRef.current = true;
      connectLiveTiming();
    }, 350);
    return () => window.clearTimeout(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (liveWsRef.current) liveWsRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (!autoRefresh || !apiUrl.trim()) return;
    fetchApi();
    const id = setInterval(fetchApi, Math.max(10, Number(refreshSeconds) || 30) * 1000);
    return () => clearInterval(id);
  }, [autoRefresh, apiUrl, refreshSeconds]);

  const sortedQ = useMemo(() => {
    return [...qRows]
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
  }, [qRows]);
  const bestTime = sortedQ.find((r) => r.time)?.time || "";
  const raceStart = new Date(RACE_START_BRT).getTime();
  const raceEnd = new Date(RACE_END_BRT).getTime();
  const raceStarted = now >= raceStart;
  const raceFinished = now >= raceEnd;
  const raceProgress = Math.min(100, Math.max(0, ((now - raceStart) / (raceEnd - raceStart)) * 100));
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
  const statusSummary = useMemo(() => {
    const entries = Object.entries(carStatus).filter(([, v]) => v && v !== "Normal");
    return entries.map(([num, status]) => ({ num, status, car: allCars.find((c) => c.num === num) })).filter((x) => x.car);
  }, [carStatus, allCars]);
  const driverTeams = useMemo(() => ["Todos", ...Array.from(new Set(pilotsSeed.map((p) => p.team))).sort()], []);
  const filteredDrivers = useMemo(() => {
    const q = driverSearch.trim().toLowerCase();
    return pilotsSeed.filter((p) => {
      const okTeam = driverFilter === "Todos" || p.team === driverFilter;
      const hay = `${p.name} ${p.nationality} ${p.carNum} ${p.team} ${p.car} ${p.role} ${p.won24h} ${p.history} ${p.watch}`.toLowerCase();
      return okTeam && (!q || hay.includes(q));
    });
  }, [driverSearch, driverFilter]);

  const resetAll = () => {
    setQRows(q1Seed);
    setAllCars(carSeed);
    setChecked({});
    setFavorites({ "#80": true, "#3": true, "#911": true, "#1": true, "#99": true, "#64": true, "#67": true, "#300": true, "#632": true });
    setCarStatus({});
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
    raceMessageKeysRef.current = new Set();
  };

  const updateRow = (index: number, key: keyof QRow, value: string) => setQRows((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const setCarChecked = (num: string, value: boolean) => setChecked((old) => ({ ...old, [num]: value }));
  const toggleFavorite = (num: string) => setFavorites((old) => ({ ...old, [num]: !old[num] }));
  const addRaceEvent = () => {
    if (!eventTitle.trim() && !eventNote.trim()) return;
    const time = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    setRaceEvents((old) => [{ id: Date.now(), time, title: eventTitle.trim() || "Observação", note: eventNote.trim(), tag: eventTag }, ...old]);
    setEventTitle("");
    setEventNote("");
  };

  return <div className="min-h-screen bg-zinc-100 p-4 text-zinc-950 md:p-8"><div className="mx-auto max-w-7xl">
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
              <h1 className="mt-2 text-4xl font-black tracking-tight md:text-6xl">Race Control de bolso</h1>
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

    <section className="mb-5 rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 xl:grid-cols-[1fr_.85fr_.9fr_.55fr_140px]">
        {tabGroups.map((group) => (
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
          <button onClick={resetAll} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-600 shadow-sm hover:bg-zinc-950 hover:text-white"><RotateCcw size={16} /> Resetar</button>
        </div>
      </div>
    </section>

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
              const status = carStatus[c.num] || "Normal";
              const tone = group?.tone || getManualStatusTone(status);
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
                    {status !== "Normal" && <Badge tone={getManualStatusTone(status)}>{status}</Badge>}
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
            <div className="overflow-x-auto">
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
                    const status = carStatus[c.num] || "Normal";
                    const tone = group?.tone || getManualStatusTone(status);
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


        {statusSummary.length > 0 && <CardBox className="p-5"><h2 className="text-2xl font-black">Carros com atenção manual</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{statusSummary.map((s) => <div key={s.num} className={`rounded-2xl border p-4 ${getRaceCardClass(getManualStatusTone(s.status))}`}><div className="flex items-center justify-between"><div className="text-2xl font-black">{s.num}</div><Badge tone={getManualStatusTone(s.status)}>{s.status}</Badge></div><div className="mt-2 font-bold">{s.car?.team}</div><div className="text-sm text-zinc-600">{s.car?.car}</div></div>)}</div></CardBox>}
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
            <div className="relative"><Search className="absolute left-3 top-3 text-zinc-400" size={18} /><input value={liveSearch} onChange={(e) => setLiveSearch(e.target.value)} placeholder="Buscar n?mero, equipe, carro, classe ou tempo..." className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-red-600" /></div>
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

        <CardBox className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-zinc-950 text-left text-white">
                <tr><th className="px-3 py-3">Pos</th><th className="px-3 py-3">Nº</th><th className="px-3 py-3">Equipe/Piloto</th><th className="px-3 py-3">Carro</th><th className="px-3 py-3">Classe</th><th className="px-3 py-3">Tempo</th><th className="px-3 py-3">Gap</th><th className="px-3 py-3">Race Control</th></tr>
              </thead>
              <tbody>{filteredLiveRows.map((r, idx) => <LiveTimingRow key={r.num + "-" + idx} row={r} index={idx} leaderTime={filteredLeaderTime} raceGroup={raceGroupByNum[r.num]} isFavorite={!!favorites[r.num]} />)}</tbody>
            </table>
          </div>
        </CardBox>

        <CardBox className="p-5"><h2 className="text-2xl font-black">L?deres por classe</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{liveLeadersByClass.slice(0, 12).map(({ cls, row }) => <div key={cls} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"><div className="flex items-center justify-between"><Badge tone={getLiveClassTone(cls)}>{cls}</Badge><div className="font-black">P{row.pos || "—"}</div></div><div className="mt-2 text-lg font-black">{row.num}</div><div className="text-sm font-bold">{row.team}</div><div className="text-xs text-zinc-600">{row.car}</div><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-sm font-black text-red-700">{row.time || "sem tempo"}</span>{favorites[row.num] && <Badge tone="amber">★</Badge>}{raceGroupByNum[row.num] && <Badge tone={raceGroupByNum[row.num].tone}>RC</Badge>}</div></div>)}</div></CardBox>
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

        <div className="grid gap-3">
          {filteredRaceMessages.length === 0 && (
            <CardBox className="p-5">
              <p className="text-sm text-zinc-600">Nenhuma mensagem recebida ainda. Conecte na aba Auto/API ou aguarde o próximo pacote do Race Control.</p>
            </CardBox>
          )}

          {filteredRaceMessages.map((msg, idx) => {
            const car = msg.carNum ? allCars.find((c) => c.num === msg.carNum) : undefined;

            return (
              <CardBox key={`${msg.time}-${msg.message}-${idx}`} className="p-4">
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
                      <div className="rounded-2xl bg-zinc-50 p-3 text-sm">
                        <div className="font-black">{car.team}</div>
                        <div className="text-zinc-600">{car.car} • {car.cls}</div>
                      </div>
                    )}
                  </div>
                </div>
              </CardBox>
            );
          })}
        </div>
      </section>
    )}

    {active === "quali" && <CardBox className="p-5"><h2 className="mb-4 text-2xl font-black">Tabela editável de classificação</h2><div className="overflow-x-auto"><table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-sm"><thead><tr className="text-left text-xs uppercase text-zinc-500"><th className="px-3">Pos</th><th>Nº</th><th>Classe</th><th>Equipe</th><th>Carro</th><th>Tempo</th><th>Gap</th></tr></thead><tbody>{sortedQ.map((row: any) => <tr key={row._idx} className="rounded-2xl bg-white shadow-sm"><td className="rounded-l-2xl px-3 py-2 font-black">{row.pos}</td><td className="py-2"><Input value={row.num} onChange={(v) => updateRow(row._idx, "num", v)} /></td><td className="py-2"><Input value={row.cls || ""} onChange={(v) => updateRow(row._idx, "cls", v)} /></td><td className="py-2"><Input value={row.team} onChange={(v) => updateRow(row._idx, "team", v)} /></td><td className="py-2"><Input value={row.car} onChange={(v) => updateRow(row._idx, "car", v)} /></td><td className="py-2"><Input value={row.time} onChange={(v) => updateRow(row._idx, "time", v)} placeholder="8:14.957" /></td><td className="rounded-r-2xl py-2 font-black text-red-700">{gap(row.time, bestTime)}</td></tr>)}</tbody></table></div></CardBox>}

    {active === "auto" && (
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
            <div className="relative"><Search className="absolute left-3 top-3 text-zinc-400" size={18} /><input value={carSearch} onChange={(e) => setCarSearch(e.target.value)} placeholder="Buscar por n?mero, equipe, carro, classe..." className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-red-600" /></div>
            <select value={carClassFilter} onChange={(e) => setCarClassFilter(e.target.value)} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-600">{classOptions.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={carGroupFilter} onChange={(e) => setCarGroupFilter(e.target.value)} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-600">{groupOptions.map((g) => <option key={g}>{g}</option>)}</select>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-600"><Badge tone="red">{filteredCars.length} carros vis?veis</Badge><Badge tone="amber">{favoriteCars.length} favoritos</Badge><Badge tone="blue">161 cards</Badge><Badge tone={raceStats.attention ? "red" : "green"}>{raceStats.attention} alertas RC</Badge></div>
        </CardBox>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCars.map((c) => {
            const live = liveByNum[c.num];
            const group = raceGroupByNum[c.num];
            const borderClass = group ? (group.tone === "red" ? "border-red-300" : group.tone === "amber" ? "border-amber-300" : "border-blue-300") : "";

            return (
              <CardBox key={c.num + "-" + c.team} className={"overflow-hidden transition " + borderClass}>
                <div className="p-4"><div className="relative"><PhotoBox src={c.photo} label={c.num + " " + c.car} /><button onClick={() => toggleFavorite(c.num)} className={(favorites[c.num] ? "bg-amber-400 text-zinc-950" : "bg-white/90 text-zinc-500") + " absolute right-2 top-2 rounded-full p-2 shadow"} title="Favoritar"><Star size={18} fill={favorites[c.num] ? "currentColor" : "none"} /></button></div></div>
                <div className="flex items-center justify-between border-y border-zinc-100 bg-zinc-50 p-4"><div className="text-3xl font-black">{c.num}</div><div className="flex flex-wrap justify-end gap-2"><Badge tone={c.group === "Favorito" ? "red" : c.group === "Surpresa" ? "amber" : c.group === "Personagem" ? "green" : "gray"}>{c.group}</Badge><Badge>{c.cls || "?"}</Badge>{group && <Badge tone={group.tone}>RC</Badge>}</div></div>
                <div className="p-4">
                  <div className="font-black">{c.team}</div>
                  <div className="mt-1 text-sm text-zinc-600">{c.car}</div>
                  <p className="mt-3 text-sm leading-6">{c.why}</p>
                  <div className={(live ? "bg-emerald-50 text-emerald-950" : "bg-zinc-50 text-zinc-500") + " mt-4 rounded-2xl p-3 text-sm"}><div className="text-[10px] font-black uppercase tracking-wider">Live timing</div>{live ? <div className="mt-1 flex flex-wrap items-center gap-2"><Badge tone="green">P{live.pos || "?"}</Badge><span className="font-black">{live.time || "sem tempo"}</span><span className="text-xs">{live.cls || c.cls}</span></div> : <div className="mt-1 font-bold">Sem dados nesta sess?o</div>}</div>
                  {group && <div className={(group.tone === "red" ? "bg-red-50 text-red-950" : group.tone === "amber" ? "bg-amber-50 text-amber-950" : "bg-blue-50 text-blue-950") + " mt-3 rounded-2xl p-3 text-sm"}><div className="flex flex-wrap items-center gap-2"><Badge tone={group.tone}>{formatRaceMessageType(group.latest.type)}</Badge><span className="text-xs font-black">{group.messages.length} msg</span></div><div className="mt-2 font-bold leading-5">{truncateText(group.latest.translatedMessage, 150)}</div><button onClick={() => setActive("racecontrol")} className="mt-2 text-xs font-black text-red-700">Ver Race Control</button></div>}
                  <select value={carStatus[c.num] || "Normal"} onChange={(e) => setCarStatus((old) => ({ ...old, [c.num]: e.target.value }))} className="mt-4 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-bold">{statusOptions.map((s) => <option key={s}>{s}</option>)}</select>
                </div>
              </CardBox>
            );
          })}
        </div>
      </section>
    )}

    {active === "pilotos" && <section className="space-y-5"><CardBox className="p-5"><div className="grid gap-4 lg:grid-cols-[1fr_260px]"><div className="relative"><Search className="absolute left-3 top-3 text-zinc-400" size={18} /><input value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} placeholder="Buscar por piloto, equipe, carro, número ou histórico..." className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-red-600" /></div><select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-red-600">{driverTeams.map((t) => <option key={t}>{t}</option>)}</select></div><div className="mt-4 flex flex-wrap items-center gap-2"><Badge tone="red">{filteredDrivers.length} pilotos em destaque</Badge><Badge tone="gray">histórico + carro + equipe</Badge></div></CardBox><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredDrivers.map((p) => <CardBox key={`${p.name}-${p.carNum}`} className="overflow-hidden"><div className="border-b border-zinc-100 bg-zinc-950 p-5 text-white"><div className="flex items-start justify-between gap-3"><div><div className="text-2xl font-black">{p.name}</div><div className="mt-1 text-sm text-zinc-300">{p.nationality} • {p.role}</div></div><Badge tone="red">{p.carNum}</Badge></div></div><div className="space-y-3 p-5"><div className="rounded-2xl bg-zinc-50 p-4"><div className="text-xs font-black uppercase tracking-wider text-zinc-500">Carro e equipe</div><div className="mt-1 font-black">{p.team}</div><div className="mt-1 text-sm text-zinc-600">{p.car}</div></div><div className="rounded-2xl bg-amber-50 p-4"><div className="text-xs font-black uppercase tracking-wider text-amber-800">Já ganhou?</div><div className="mt-1 text-sm font-bold text-zinc-800">{p.won24h}</div></div><div><div className="text-sm font-black text-red-700">Mini histórico</div><p className="mt-1 text-sm leading-6 text-zinc-700">{p.history}</p></div><div><div className="text-sm font-black text-zinc-900">Por que acompanhar</div><p className="mt-1 text-sm leading-6 text-zinc-700">{p.watch}</p></div></div></CardBox>)}</div></section>}

    {active === "checklist" && <CardBox className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Caça aos carros</h2><p className="mt-1 text-sm text-zinc-600">Quando marcar, o card fica verde de confirmado.</p></div><Badge tone="green">{checkedCount}/{allCars.length} vistos</Badge></div><div className="mt-5 grid gap-3 md:grid-cols-2">{allCars.map((car) => { const isChecked = !!checked[car.num]; return <label key={car.num} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${isChecked ? "border-emerald-500 bg-emerald-50 text-emerald-950" : "border-zinc-200 bg-white hover:bg-zinc-50"}`}><input type="checkbox" checked={isChecked} onChange={(e) => setCarChecked(car.num, e.target.checked)} className="h-5 w-5 accent-emerald-700" /><div className="flex-1"><div className="font-black">{car.num} — {car.car}</div><div className="text-sm opacity-75">{car.team}</div></div>{isChecked ? <Badge tone="green">Confirmado</Badge> : <Badge>Pendente</Badge>}</label>; })}</div></CardBox>}

    {active === "placar" && <CardBox className="p-5"><h2 className="text-2xl font-black">Placar por fases</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-sm"><thead><tr className="text-left text-xs uppercase text-zinc-500"><th>Fase</th><th>Líder geral</th><th>Surpresa</th><th>Observação</th></tr></thead><tbody>{phases.map((p, idx) => <tr key={p.phase} className="bg-white shadow-sm"><td className="rounded-l-2xl px-3 py-2 font-black">{p.phase}</td><td className="py-2"><Input value={p.leader} onChange={(v) => setPhases((rows) => rows.map((r, i) => i === idx ? { ...r, leader: v } : r))} /></td><td className="py-2"><Input value={p.surprise} onChange={(v) => setPhases((rows) => rows.map((r, i) => i === idx ? { ...r, surprise: v } : r))} /></td><td className="rounded-r-2xl py-2 pr-2"><Input value={p.note} onChange={(v) => setPhases((rows) => rows.map((r, i) => i === idx ? { ...r, note: v } : r))} /></td></tr>)}</tbody></table></div></CardBox>}

    {active === "timeline" && <CardBox className="p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Timeline da corrida</h2><p className="mt-1 text-sm text-zinc-600">Use para registrar chuva, pits, acidentes, Code 60, abandono e momentos legais.</p></div><Badge tone="red">{raceEvents.length} eventos</Badge></div><div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_150px]"><Input value={eventTitle} onChange={setEventTitle} placeholder="Título do evento" /><Input value={eventNote} onChange={setEventNote} placeholder="Observação" /><select value={eventTag} onChange={(e) => setEventTag(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-bold"><option>Observação</option><option>Incidente</option><option>Pit</option><option>Chuva</option><option>Code 60</option><option>Ultrapassagem</option><option>Abandono</option></select><button onClick={addRaceEvent} className="flex items-center justify-center gap-2 rounded-2xl bg-red-700 px-4 py-3 text-sm font-black text-white"><Plus size={17} />Adicionar</button></div><div className="mt-5 space-y-3">{raceEvents.map((e) => <div key={e.id} className="grid gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 p-4 md:grid-cols-[100px_120px_1fr_40px]"><div className="font-black">{e.time}</div><div><Badge tone={e.tag === "Incidente" || e.tag === "Abandono" ? "red" : e.tag === "Chuva" || e.tag === "Code 60" ? "amber" : "gray"}>{e.tag}</Badge></div><div><div className="font-black">{e.title}</div>{e.note && <p className="mt-1 text-sm text-zinc-600">{e.note}</p>}</div><button onClick={() => setRaceEvents((old) => old.filter((x) => x.id !== e.id))} className="rounded-xl bg-white p-2 text-zinc-500 hover:text-red-700"><Trash2 size={17} /></button></div>)}</div></CardBox>}

    {active === "refs" && <CardBox className="p-5"><h2 className="text-2xl font-black">Referência de tempos</h2><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[800px] text-sm"><thead className="bg-zinc-900 text-left text-white"><tr><th className="p-3">Ano</th><th>Sessão</th><th>Mais rápido</th><th>Melhor tempo</th><th>P10</th><th>Janela</th><th>Nota</th></tr></thead><tbody>{references.map((r) => <tr key={r.year} className="border-b border-zinc-100"><td className="p-3 font-black">{r.year}</td><td>{r.session}</td><td>{r.p1}</td><td className="font-black text-red-700">{r.best}</td><td>{r.p10}</td><td>{r.window}</td><td>{r.note}</td></tr>)}</tbody></table></div></CardBox>}
  </div></div>;
}