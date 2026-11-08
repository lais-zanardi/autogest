import { FipeBrand, FipeModel, FipeYear, FipePriceQuote } from '@autogest/shared-types';

export const FIPE_LOCAL_BRANDS: FipeBrand[] = [
  { codigo: '6', nome: 'Audi' },
  { codigo: '7', nome: 'BMW' },
  { codigo: '171', nome: 'BYD' },
  { codigo: '161', nome: 'Caoa Chery' },
  { codigo: '13', nome: 'Citroën' },
  { codigo: '21', nome: 'Fiat' },
  { codigo: '22', nome: 'Ford' },
  { codigo: '23', nome: 'GM - Chevrolet' },
  { codigo: '189', nome: 'GWM' },
  { codigo: '25', nome: 'Honda' },
  { codigo: '26', nome: 'Hyundai' },
  { codigo: '177', nome: 'JAC' },
  { codigo: '29', nome: 'Jeep' },
  { codigo: '31', nome: 'Kia' },
  { codigo: '33', nome: 'Land Rover' },
  { codigo: '39', nome: 'Mercedes-Benz' },
  { codigo: '41', nome: 'Mitsubishi' },
  { codigo: '43', nome: 'Nissan' },
  { codigo: '44', nome: 'Peugeot' },
  { codigo: '47', nome: 'Porsche' },
  { codigo: '185', nome: 'RAM' },
  { codigo: '54', nome: 'Renault' },
  { codigo: '56', nome: 'Toyota' },
  { codigo: '57', nome: 'Troller' },
  { codigo: '58', nome: 'Volvo' },
  { codigo: '59', nome: 'VW - VolksWagen' },
];

export const FIPE_LOCAL_MODELS: Record<string, FipeModel[]> = {
  // Audi
  '6': [
    { codigo: '601', nome: 'A3 Sedan 1.4/2.0 TFSI Tiptronic' },
    { codigo: '602', nome: 'A4 Sedan 2.0 TFSI S-Tronic' },
    { codigo: '603', nome: 'Q3 1.4/2.0 TFSI Quattro S-Tronic' },
    { codigo: '604', nome: 'Q5 2.0 TFSI Quattro S-Tronic' },
    { codigo: '605', nome: 'e-tron S Sportback Quattro (Elétrico)' },
  ],
  // BMW
  '7': [
    { codigo: '701', nome: '320i 2.0 Turbo ActiveFlex/GP Aut.' },
    { codigo: '702', nome: 'X1 sDrive20i 2.0 Turbo Flex Aut.' },
    { codigo: '703', nome: 'X3 xDrive30e 2.0 Híbrido Aut.' },
    { codigo: '704', nome: 'M3 Competition 3.0 Bi-Turbo' },
    { codigo: '705', nome: 'iX3 M Sport Elétrico' },
  ],
  // BYD
  '171': [
    { codigo: '17101', nome: 'Dolphin EV (100% Elétrico)' },
    { codigo: '17102', nome: 'Dolphin Mini EV 5p' },
    { codigo: '17103', nome: 'Song Plus DM-i Híbrido Plug-in' },
    { codigo: '17104', nome: 'Seal EV AWD 531cv' },
    { codigo: '17105', nome: 'Yuan Plus EV 5p' },
  ],
  // Caoa Chery
  '161': [
    { codigo: '16101', nome: 'Tiggo 5X Pro 1.5 Turbo Flex Aut.' },
    { codigo: '16102', nome: 'Tiggo 7 Pro Max Drive 1.6 Turbo Aut.' },
    { codigo: '16103', nome: 'Tiggo 8 Pro Plug-in Hybrid' },
    { codigo: '16104', nome: 'Arrizo 6 Pro 1.5 Turbo Flex Aut.' },
  ],
  // Citroën
  '13': [
    { codigo: '1301', nome: 'C3 Live/Feel 1.0 Flex 6V 5p' },
    { codigo: '1302', nome: 'C3 Aircross Feel 1.0 Turbo 200 Aut.' },
    { codigo: '1303', nome: 'C4 Cactus Feel 1.6 16V Flex Aut.' },
  ],
  // Fiat
  '21': [
    { codigo: '2101', nome: 'Strada Freedom 1.3 Flex 8V CD' },
    { codigo: '2102', nome: 'Strada Volcano 1.3 Flex CD Aut.' },
    { codigo: '2103', nome: 'Argo Drive 1.0 6V Flex' },
    { codigo: '2104', nome: 'Argo Trekking 1.3 Flex 5p' },
    { codigo: '2105', nome: 'Toro Volcano 2.0 16V 4x4 Diesel Aut.' },
    { codigo: '2106', nome: 'Toro Ultra/Ranch 2.0 Diesel 4x4 Aut.' },
    { codigo: '2107', nome: 'Mobi Like 1.0 Fire Flex 5p.' },
    { codigo: '2108', nome: 'Pulse Audace 1.0 Turbo 200 Flex Aut.' },
    { codigo: '2109', nome: 'Pulse Abarth 1.3 Turbo 270 Flex Aut.' },
    { codigo: '2110', nome: 'Fastback Impetus 1.0 Turbo Flex Aut.' },
    { codigo: '2111', nome: 'Cronos Drive 1.3 Flex 8V 4p' },
    { codigo: '2112', nome: 'Fiorino Endurance 1.4 Flex 8V' },
  ],
  // Ford
  '22': [
    { codigo: '2201', nome: 'Ka SE 1.0 Ti-VCT Flex 5p' },
    { codigo: '2202', nome: 'Ka Sedan Titanium 1.5 12V Aut.' },
    { codigo: '2203', nome: 'EcoSport SE 1.5 12V Flex 5p Aut.' },
    { codigo: '2204', nome: 'Ranger XLT 3.2 20V 4x4 CD Diesel Aut.' },
    { codigo: '2205', nome: 'Ranger Limited 3.0 V6 4WD Diesel Aut.' },
    { codigo: '2206', nome: 'Territory Titanium 1.5 Turbo EcoBoost Aut.' },
    { codigo: '2207', nome: 'Maverick Lariat FX4 2.0 Turbo 4WD Aut.' },
  ],
  // GM - Chevrolet
  '23': [
    { codigo: '2301', nome: 'Onix Hatch LT 1.0 12V Flex 5p Mec.' },
    { codigo: '2302', nome: 'Onix Hatch Premier 1.0 Turbo Flex Aut.' },
    { codigo: '2303', nome: 'Onix Plus Premier 1.0 Turbo Flex Aut.' },
    { codigo: '2304', nome: 'Tracker Premier 1.2 Turbo 12V Flex Aut.' },
    { codigo: '2305', nome: 'Tracker LTZ 1.0 Turbo Flex Aut.' },
    { codigo: '2306', nome: 'S10 Pick-Up LTZ 2.8 TDI 4x4 CD Diesel Aut.' },
    { codigo: '2307', nome: 'S10 High Country 2.8 TDI 4x4 CD Aut.' },
    { codigo: '2308', nome: 'Cruze LTZ 1.4 16V Turbo Flex 4p Aut.' },
    { codigo: '2309', nome: 'Spin LTZ 1.8 8V Econo.Flex 5p Aut.' },
    { codigo: '2310', nome: 'Montana Premier 1.2 Turbo Flex Aut.' },
    { codigo: '2311', nome: 'Equinox Premier 1.5 Turbo AWD Aut.' },
  ],
  // GWM
  '189': [
    { codigo: '18901', nome: 'Haval H6 HEV Híbrido Aut.' },
    { codigo: '18902', nome: 'Haval H6 PHEV Híbrido Plug-in AWD' },
    { codigo: '18903', nome: 'Haval H6 GT PHEV AWD Aut.' },
    { codigo: '18904', nome: 'Ora 03 Skin/GT Elétrico 5p' },
  ],
  // Honda
  '25': [
    { codigo: '2501', nome: 'Civic Sedan Touring 1.5 Turbo 16V Aut. 4p' },
    { codigo: '2502', nome: 'Civic Sedan EXL 2.0 Flex 16V Aut. 4p' },
    { codigo: '2503', nome: 'Civic Híbrido e:HEV 2.0 Aut.' },
    { codigo: '2504', nome: 'HR-V EXL 1.5 Flex 16V 5p Aut.' },
    { codigo: '2505', nome: 'HR-V Touring 1.5 Turbo Flex Aut.' },
    { codigo: '2506', nome: 'Fit EXL 1.5 Flexone 16V 5p Aut.' },
    { codigo: '2507', nome: 'City Sedan Touring 1.5 16V Flex Aut.' },
    { codigo: '2508', nome: 'City Hatchback Touring 1.5 Flex Aut.' },
    { codigo: '2509', nome: 'CR-V Touring 1.5 Turbo 4WD Aut.' },
    { codigo: '2510', nome: 'ZR-V Touring 2.0 16V Aut.' },
  ],
  // Hyundai
  '26': [
    { codigo: '2601', nome: 'HB20 Sense 1.0 12V Flex Mec.' },
    { codigo: '2602', nome: 'HB20 Platinum Plus 1.0 Turbo Flex Aut.' },
    { codigo: '2603', nome: 'HB20S Platinum Plus 1.0 Turbo Flex Aut.' },
    { codigo: '2604', nome: 'Creta Prestige 2.0 16V Flex Aut.' },
    { codigo: '2605', nome: 'Creta Ultimate 2.0 16V Flex Aut.' },
    { codigo: '2606', nome: 'Creta N Line 1.0 Turbo Flex Aut.' },
    { codigo: '2607', nome: 'Tucson GLS 1.6 Turbo 16V Aut.' },
  ],
  // JAC
  '177': [
    { codigo: '17701', nome: 'E-JS1 100% Elétrico' },
    { codigo: '17702', nome: 'T60 Plus 1.5 Turbo Flex Aut.' },
  ],
  // Jeep
  '29': [
    { codigo: '2901', nome: 'Renegade Longitude 1.3 T270 4x2 Flex Aut.' },
    { codigo: '2902', nome: 'Renegade Trailhawk 1.3 T270 4x4 Flex Aut.' },
    { codigo: '2903', nome: 'Compass Limited 1.3 T270 4x2 Flex Aut.' },
    { codigo: '2904', nome: 'Compass Longitude 2.0 4x4 Diesel Aut.' },
    { codigo: '2905', nome: 'Commander Overland 1.3 T270 Flex Aut.' },
    { codigo: '2906', nome: 'Commander Overland 2.0 TD380 4x4 Diesel' },
  ],
  // Kia
  '31': [
    { codigo: '3101', nome: 'Sportage EX Prestige 1.6 Turbo Híbrido Aut.' },
    { codigo: '3102', nome: 'Stonic SX 1.0 Turbo Híbrido Leve Aut.' },
    { codigo: '3103', nome: 'Cerato SX 2.0 16V Flex Aut.' },
  ],
  // Land Rover
  '33': [
    { codigo: '3301', nome: 'Discovery Sport SE 2.0 Turbo Flex Aut.' },
    { codigo: '3302', nome: 'Range Rover Evoque R-Dynamic 2.0 Flex Aut.' },
    { codigo: '3303', nome: 'Defender 110 HSE 2.0 Turbo 4WD' },
  ],
  // Mercedes-Benz
  '39': [
    { codigo: '3901', nome: 'C-200 EQ Boost Avantgarde 1.5 Turbo Aut.' },
    { codigo: '3902', nome: 'GLA 200 AMG Line 1.3 Turbo Aut.' },
    { codigo: '3903', nome: 'GLC 300 2.0 Turbo 4MATIC Aut.' },
  ],
  // Mitsubishi
  '41': [
    { codigo: '4101', nome: 'L200 Triton Sport HPE 2.4 Diesel 4x4 Aut.' },
    { codigo: '4102', nome: 'Eclipse Cross HPE-S 1.5 Turbo 4x4 CVT' },
    { codigo: '4103', nome: 'Pajero Sport HPE-S 2.4 Diesel 4x4 Aut.' },
  ],
  // Nissan
  '43': [
    { codigo: '4301', nome: 'Kicks Exclusive 1.6 16V Flex Aut.' },
    { codigo: '4302', nome: 'Kicks Advance 1.6 16V Flex Aut.' },
    { codigo: '4303', nome: 'Versa Exclusive 1.6 16V Flex Aut.' },
    { codigo: '4304', nome: 'Frontier Attack 2.3 Bi-Turbo 4x4 Diesel Aut.' },
    { codigo: '4305', nome: 'Frontier PRO-4X 2.3 Diesel 4x4 Aut.' },
    { codigo: '4306', nome: 'Sentra Exclusive 2.0 16V CVT' },
  ],
  // Peugeot
  '44': [
    { codigo: '4401', nome: '208 Griffe 1.0 Turbo 200 Flex Aut.' },
    { codigo: '4402', nome: '208 Like 1.0 Flex 6V Mec.' },
    { codigo: '4403', nome: '2008 Griffe 1.6 THP Turbo Aut.' },
  ],
  // Porsche
  '47': [
    { codigo: '4701', nome: 'Macan 2.0 Turbo PDK' },
    { codigo: '4702', nome: 'Cayenne E-Hybrid 3.0 V6 Aut.' },
    { codigo: '4703', nome: '911 Carrera S 3.0 Bi-Turbo PDK' },
  ],
  // RAM
  '185': [
    { codigo: '18501', nome: 'Rampage Laramie 2.0 Turbo Gasolina 4x4 Aut.' },
    { codigo: '18502', nome: 'Rampage Rebel 2.0 Diesel 4x4 Aut.' },
    { codigo: '18503', nome: '1500 Rebel 5.7 V8 HEMI 4x4 Aut.' },
  ],
  // Renault
  '54': [
    { codigo: '5401', nome: 'Kwid Zen 1.0 Flex 12V 5p Mec.' },
    { codigo: '5402', nome: 'Kwid Outsider 1.0 Flex 12V Mec.' },
    { codigo: '5403', nome: 'Duster Iconic 1.3 TCe Flex Aut.' },
    { codigo: '5404', nome: 'Sandero Stepway Zen 1.6 16V Flex Mec.' },
    { codigo: '5405', nome: 'Oroch Outsider 1.3 TCe Flex Aut.' },
    { codigo: '5406', nome: 'Kardian Première Edition 1.0 Turbo EDC' },
    { codigo: '5407', nome: 'Master Furgão 2.3 dCi Diesel Mec.' },
  ],
  // Toyota
  '56': [
    { codigo: '5601', nome: 'Corolla Altis Premium 2.0 Flex 16V Aut.' },
    { codigo: '5602', nome: 'Corolla Altis Hybrid 1.8 16V Flex Aut.' },
    { codigo: '5603', nome: 'Corolla XEi 2.0 Flex 16V Aut.' },
    { codigo: '5604', nome: 'Corolla Cross XRE 2.0 16V Flex Aut.' },
    { codigo: '5605', nome: 'Corolla Cross XRX Hybrid 1.8 Flex Aut.' },
    { codigo: '5606', nome: 'Hilux SRX 2.8 TDI 16V 4x4 CD Diesel Aut.' },
    { codigo: '5607', nome: 'Hilux GR-Sport 2.8 TDI 4x4 CD Aut.' },
    { codigo: '5608', nome: 'Yaris Sedan XLS 1.5 16V Flex Aut.' },
    { codigo: '5609', nome: 'Yaris Hatch XS 1.5 Flex Aut.' },
    { codigo: '5610', nome: 'SW4 SRX 2.8 TDI 16V 4x4 Diesel Aut. 7L' },
  ],
  // Troller
  '57': [
    { codigo: '5701', nome: 'T4 XLT 3.2 20V 4x4 Turbodiesel Mec.' },
    { codigo: '5702', nome: 'T4 TX4 3.2 20V 4x4 Turbodiesel Aut.' },
  ],
  // Volvo
  '58': [
    { codigo: '5801', nome: 'XC40 Recharge Plus (100% Elétrico)' },
    { codigo: '5802', nome: 'XC60 T8 Recharge Inscription Híbrido AWD' },
    { codigo: '5803', nome: 'EX30 Ultra 69kWh Elétrico' },
  ],
  // VW - VolksWagen
  '59': [
    { codigo: '8323', nome: 'Gol 1.0 Flex 12V 5p' },
    { codigo: '5901', nome: 'Polo Highline 1.0 TSI Flex Aut.' },
    { codigo: '5902', nome: 'Polo Track 1.0 MPI Flex Mec.' },
    { codigo: '5903', nome: 'Polo GTS 1.4 TSI Flex 16V Aut.' },
    { codigo: '5904', nome: 'T-Cross Highline 1.4 TSI Flex Aut.' },
    { codigo: '5905', nome: 'T-Cross Comfortline 1.0 TSI Flex Aut.' },
    { codigo: '5906', nome: 'Nivus Highline 1.0 TSI Flex Aut.' },
    { codigo: '5907', nome: 'Virtus Highline 1.0 TSI Flex Aut.' },
    { codigo: '5908', nome: 'Virtus Exclusive 1.4 TSI Flex Aut.' },
    { codigo: '5585', nome: 'Amarok CD 2.0 16V TDI 4x4 Diesel Aut.' },
    { codigo: '5586', nome: 'Amarok V6 Highline 3.0 TDI 4x4 Aut.' },
    { codigo: '5909', nome: 'Taos Highline 1.4 TSI Flex Aut.' },
    { codigo: '5910', nome: 'Saveiro Cross 1.6 16V Flex CD' },
    { codigo: '5911', nome: 'Jetta GLI 350 TSI 2.0 Turbo DSG 4p' },
  ],
};

export const FIPE_LOCAL_YEARS: FipeYear[] = [
  { codigo: '32000-1', nome: 'Zero KM' },
  { codigo: '2026-1', nome: '2026 Gasolina' },
  { codigo: '2025-5', nome: '2025 Flex' },
  { codigo: '2024-5', nome: '2024 Flex' },
  { codigo: '2023-5', nome: '2023 Flex' },
  { codigo: '2022-5', nome: '2022 Flex' },
  { codigo: '2021-5', nome: '2021 Flex' },
  { codigo: '2020-5', nome: '2020 Flex' },
  { codigo: '2019-5', nome: '2019 Flex' },
  { codigo: '2018-5', nome: '2018 Flex' },
  { codigo: '2017-5', nome: '2017 Flex' },
  { codigo: '2016-5', nome: '2016 Flex' },
  { codigo: '2015-5', nome: '2015 Flex' },
  { codigo: '2014-5', nome: '2014 Flex' },
  { codigo: '2013-5', nome: '2013 Flex' },
  { codigo: '2012-5', nome: '2012 Flex' },
  { codigo: '2011-5', nome: '2011 Flex' },
  { codigo: '2010-5', nome: '2010 Flex' },
];

export function parseValorFipeCentavos(valorTexto: string): number {
  if (!valorTexto || typeof valorTexto !== 'string') {
    return 0;
  }
  const limpo = valorTexto
    .replace(/R\$/gi, '')
    .replace(/[\s\u00A0.]/g, '')
    .trim();
  const match = /^(\d+)(?:,(\d{1,2}))?$/.exec(limpo);
  if (!match) return 0;
  const reais = parseInt(match[1], 10);
  const centavosStr = (match[2] || '00').padEnd(2, '0');
  return reais * 100 + parseInt(centavosStr, 10);
}

const MESES_PORTUGUES: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  março: '03',
  marco: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

export function normalizarMesReferenciaFipe(mesReferencia: string): string {
  if (!mesReferencia || typeof mesReferencia !== 'string') {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const trimmed = mesReferencia.trim().toLowerCase();
  const isoMatch = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
  const parts = /^([a-zç]+)\s+de\s+(\d{4})$/i.exec(trimmed);
  if (parts && MESES_PORTUGUES[parts[1]]) {
    return `${parts[2]}-${MESES_PORTUGUES[parts[1]]}`;
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Gera cotação determinística e realista para qualquer combinação de marca, modelo e ano
 */
export function getMockFipeQuote(
  marcaCodigo: string,
  modeloCodigo: string,
  anoCodigo: string,
): FipePriceQuote {
  const marcaObj = FIPE_LOCAL_BRANDS.find(b => b.codigo === marcaCodigo);
  const marcaNome = marcaObj ? marcaObj.nome : 'Marca Veicular';

  const modelosDaMarca = FIPE_LOCAL_MODELS[marcaCodigo] || [];
  const modeloObj = modelosDaMarca.find(m => m.codigo === modeloCodigo);
  const modeloNome = modeloObj ? modeloObj.nome : 'Modelo Veicular Padrão';

  const anoAnoNum = parseInt(anoCodigo.split('-')[0], 10) || 2022;
  const isDiesel = modeloNome.toLowerCase().includes('diesel');
  const isEletrico = modeloNome.toLowerCase().includes('elétrico') || modeloNome.toLowerCase().includes('ev');
  const combustivel = isEletrico ? 'Elétrico' : isDiesel ? 'Diesel' : 'Flex';
  const sigla = isEletrico ? 'E' : isDiesel ? 'D' : 'F';

  let valorBase = 98000;
  if (modeloNome.includes('Gol') || modeloNome.includes('Mobi') || modeloNome.includes('Kwid')) {
    valorBase = 54000;
  } else if (modeloNome.includes('Corolla') || modeloNome.includes('Civic') || modeloNome.includes('Compass')) {
    valorBase = 155000;
  } else if (modeloNome.includes('Hilux') || modeloNome.includes('Ranger') || modeloNome.includes('Amarok') || modeloNome.includes('Commander')) {
    valorBase = 265000;
  } else if (modeloNome.includes('BMW') || modeloNome.includes('Audi') || modeloNome.includes('Porsche') || modeloNome.includes('Volvo')) {
    valorBase = 320000;
  } else if (modeloNome.includes('Dolphin') || modeloNome.includes('Song') || modeloNome.includes('Haval')) {
    valorBase = 160000;
  }

  const anosAtras = Math.max(0, 2026 - anoAnoNum);
  const valorFinalReais = Math.round(valorBase * Math.pow(0.93, anosAtras));
  const valorCentavos = valorFinalReais * 100;

  const valorFormatado = `R$ ${valorFinalReais.toLocaleString('pt-BR')},00`;

  const now = new Date();
  const mesAtualNome = now.toLocaleString('pt-BR', { month: 'long' });
  const anoAtual = now.getFullYear();

  return {
    codigoFipe: `00${marcaCodigo.padStart(2, '0')}${modeloCodigo.slice(-3)}-${(parseInt(marcaCodigo, 10) + parseInt(modeloCodigo, 10)) % 10}`,
    marca: marcaNome,
    modelo: modeloNome,
    anoModelo: anoAnoNum,
    combustivel,
    siglaCombustivel: sigla,
    valorFormatado,
    valorCentavos,
    mesReferenciaTexto: `${mesAtualNome} de ${anoAtual}`,
    mesReferenciaIso: `${anoAtual}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  };
}
