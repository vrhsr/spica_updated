
export type Slide = {
  id: string;
  number: number;
  url: string;
  medicineName: string;
};

// A more specific, fixed list of 34 standard slides with medicine names
export const allSlides: Slide[] = [
    { id: 'slide-1', number: 1, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/01_SPICA-SG_sgbh8x.jpg', medicineName: 'welcome' },
    { id: 'slide-2', number: 2, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/02_ACEDORA_olo5se.jpg', medicineName: 'ACEDORA' },
    { id: 'slide-3', number: 3, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/03_AMIGLAND-10_tlvmgp.jpg', medicineName: 'AMIGLAND-10' },
    { id: 'slide-4', number: 4, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/04_AMIGLAND-C_n5fl8m.jpg', medicineName: 'AMIGLAND-C' },
    { id: 'slide-5', number: 5, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/05_AURIUM-AP_xkafpq.jpg', medicineName: 'AURIUM-AP' },
    { id: 'slide-6', number: 6, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/06_BROSILENTUS_jkpc5v.jpg', medicineName: 'BROSILENTUS' },
    { id: 'slide-7', number: 7, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/07_BROLINCTUS-LS_gbqpwl.jpg', medicineName: 'BROLINCTUS-LS' },
    { id: 'slide-8', number: 8, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/08_CALCISURE-TAB-SYP_abh094.jpg', medicineName: 'CALCISURE-TAB-SYP' },
    { id: 'slide-9', number: 9, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/09_DERIVIT-200ML_crgfyp.jpg', medicineName: 'DERIVIT-200ML' },
    { id: 'slide-10', number: 10, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/11_DERIVIT-DHA_zyib0i.jpg', medicineName: 'DERIVIT-DHA' },
    { id: 'slide-11', number: 11, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/12_DERIVIT_yak3im.jpg', medicineName: 'DERIVIT' },
    { id: 'slide-12', number: 12, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/13_DORA_qgcu5z.jpg', medicineName: 'DORA' },
    { id: 'slide-13', number: 13, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/14_DORA-650_ankzh6.jpg', medicineName: 'DORA-650' },
    { id: 'slide-14', number: 14, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/15_DORACOLD_mcrp7m.jpg', medicineName: 'DORACOLD' },
    { id: 'slide-15', number: 15, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/16_FEROGLAD_z4ze8y.jpg', medicineName: 'FEROGLAD' },
    { id: 'slide-16', number: 16, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/17-FERIGLAD_bukfxv.jpg', medicineName: 'FERIGLAD' },
    { id: 'slide-17', number: 17, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/19_GABAGLAND_zrtadk.jpg', medicineName: 'GABAGLAND' },
    { id: 'slide-18', number: 18, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/20_LAXSIV_y2k60x.jpg', medicineName: 'LAXSIV' },
    { id: 'slide-19', number: 19, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/21_MEFEKA-P-200MG_ncprdw.jpg', medicineName: 'MEFEKA-P-200MG' },
    { id: 'slide-20', number: 20, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/22_MEFEKA-P_zserib.jpg', medicineName: 'MEFEKA-P' },
    { id: 'slide-21', number: 21, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/23_MEVITOL-B_cqf7cg.jpg', medicineName: 'MEVITOL-B' },
    { id: 'slide-22', number: 22, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/24_OFGLAND-OZ_gkoadn.jpg', medicineName: 'OFGLAND-OZ' },
    { id: 'slide-23', number: 23, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/25_PANTAGLAND-DSR_g7lp4n.jpg', medicineName: 'PANTAGLAND-DSR' },
    { id: 'slide-24', number: 24, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/26_PERISG_gk8vui.jpg', medicineName: 'PERISG' },
    { id: 'slide-25', number: 25, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/27_RABIGLAND-DSR_dew6nc.jpg', medicineName: 'RABIGLAND-DSR' },
    { id: 'slide-26', number: 26, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/28_SILENTUS-DX_ndv2bn.jpg', medicineName: 'SILENTUS-DX' },
    { id: 'slide-27', number: 27, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/29_SILENTUS-P_luhkmv.jpg', medicineName: 'SILENTUS-P' },
    { id: 'slide-28', number: 28, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/30_SPIKAZYME_tyan4l.jpg', medicineName: 'SPIKAZYME' },
    { id: 'slide-29', number: 29, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/31_SUCRAFT_civqrb.jpg', medicineName: 'SUCRAFT' },
    { id: 'slide-30', number: 30, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/32_SUCRAFT-O_ynl51i.jpg', medicineName: 'SUCRAFT-O' },
    { id: 'slide-31', number: 31, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/33_ULCIGLAD_v6ncoq.jpg', medicineName: 'ULCIGLAD' },
    { id: 'slide-32', number: 32, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/34_UTRONIM_jogybh.jpg', medicineName: 'UTRONIM' },
    { id: 'slide-33', number: 33, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/35_VITAGLAD_eyeixy.jpg', medicineName: 'VITAGLAD' },
    { id: 'slide-34', number: 34, url: 'https://res.cloudinary.com/daxtfjb3u/image/upload/v1719586111/36_THANKYOU_l2yyqj.jpg', medicineName: 'Thank You' },
  ];
