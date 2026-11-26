// All Estonian text the user sees, in one place so it is easy to review with the client.
// Sections are owned by the area that uses them: the frontend adds the UI sections here.

/** Text in the exported .xlsx file (Backend area). */
export const xlsx = {
  headers: {
    no: 'Nr',
    date: 'Kuupäev',
    description: 'Kirjeldus',
    quantity: 'Kogus',
    unit: 'Ühik',
    unitPrice: 'Ühiku hind',
    total: 'Summa',
  },
  totals: {
    subtotal: 'Vahesumma',
    taxRate: 'Käibemaksumäär',
    tax: 'Käibemaks',
    total: 'Kokku koos käibemaksuga',
  },
  percentUnit: 'ülalolevatest',
  defaultSheetName: 'Projekt',
} as const;

/** Error messages returned by the API routes (Backend area). */
export const api = {
  notSignedIn: 'Palun logi sisse.',
  projectNotFound: 'Projekti ei leitud.',
  exportFailed: 'Exceli faili loomine ebaõnnestus. Palun proovi uuesti.',
} as const;

/** Validation and save messages from the server actions (Backend area). */
export const validation = {
  saveFailed: 'Salvestamine ebaõnnestus. Palun proovi uuesti.',
  profileMissing: 'Kasutaja profiili ei leitud. Logi välja ja uuesti sisse.',
  projectNotFound: 'Projekti ei leitud.',
  rowNotFound: 'Rida ei leitud.',
  columnNotFound: 'Veergu ei leitud.',
  invalidId: 'Vigane viide. Laadi leht uuesti.',
  projectNameRequired: 'Sisesta projekti nimi.',
  columnNameRequired: 'Sisesta veeru nimi.',
  tooLong: (max: number) => `Kuni ${max} märki.`,
  invalidNumber: (decimals: number) => `Sisesta number, kuni ${decimals} kohta pärast koma (nt 12,50).`,
  taxRateRange: 'Käibemaksumäär peab olema vahemikus 0–100 %.',
  quantityNegative: 'Kogus ei saa olla negatiivne.',
  numberTooLarge: 'Number on liiga suur.',
  percentRange: 'Protsent peab olema vahemikus −100 kuni 9999,99.',
  quantityRequired: 'Sisesta kogus.',
  unitPriceRequired: 'Sisesta ühiku hind.',
  percentRequired: 'Sisesta protsent.',
  invalidCalcType: 'Vali arvutuse tüüp.',
  invalidDate: 'Sisesta kuupäev kujul pp.kk.aaaa.',
  invalidOrder: 'Ridade järjekord on vahepeal muutunud. Laadi leht uuesti.',
} as const;

/** Sign-up, login and email confirmation messages (Backend area). */
export const auth = {
  invalidEmail: 'Sisesta korrektne e-posti aadress.',
  passwordRequired: 'Sisesta parool.',
  passwordTooShort: (min: number) => `Parool peab olema vähemalt ${min} märki pikk.`,
  invalidCredentials: 'Vale e-posti aadress või parool.',
  emailNotConfirmed: 'Kinnita oma e-posti aadress. Saatsime sulle kinnituslingi.',
  emailExists: 'Selle e-posti aadressiga konto on juba olemas. Logi sisse.',
  weakPassword: 'Parool on liiga nõrk. Kasuta pikemat parooli, kus on tähti ja numbreid.',
  tooManyAttempts: 'Liiga palju katseid. Proovi mõne minuti pärast uuesti.',
  signupDisabled: 'Uute kontode loomine on praegu suletud.',
  confirmLinkInvalid: 'Kinnituslink on aegunud või vigane. Logi sisse või loo konto uuesti.',
  failed: 'Midagi läks valesti. Palun proovi uuesti.',
} as const;

/** Text in the app UI (Frontend area). */
export const ui = {
  appName: 'Lihtne Excel',
  appDescription: 'Koosta projekti eelarve ja laadi see alla Exceli failina.',
  auth: {
    login: 'Logi sisse',
    signup: 'Loo konto',
    email: 'E-post',
    password: 'Parool',
    passwordHint: (min: number) => `Vähemalt ${min} märki.`,
    showPassword: 'Näita parooli',
    hidePassword: 'Peida parool',
    pending: 'Palun oota…',
    noAccount: 'Pole veel kontot?',
    haveAccount: 'Konto on juba olemas?',
    checkEmail: 'Kontrolli oma e-posti ja kinnita konto. Seejärel saad sisse logida.',
    emailRequired: 'Sisesta e-posti aadress.',
    emailInvalid: 'Sisesta e-post kujul nimi@näide.ee.',
    passwordRequired: 'Sisesta parool.',
    passwordTooShort: (min: number) => `Parool peab olema vähemalt ${min} märki.`,
    errors: {
      invalidCredentials: 'Vale e-post või parool.',
      userExists: 'Selle e-postiga konto on juba olemas. Logi sisse.',
      weakPassword: 'Parool on liiga lihtne. Vali pikem parool.',
      emailNotConfirmed: 'Kinnita enne sisselogimist oma e-post. Vaata postkasti.',
      emailInvalid: 'See e-posti aadress ei sobi. Kontrolli, kas see on õigesti kirjutatud.',
      rateLimit: 'Liiga palju katseid. Oota veidi ja proovi uuesti.',
      network: 'Ühendus puudub. Kontrolli internetti ja proovi uuesti.',
      unknown: 'Midagi läks valesti. Proovi uuesti.',
    },
  },
  projects: {
    title: 'Projektid',
    empty: 'Sul pole veel ühtegi projekti.',
    emptyHint: 'Alusta nupuga „Uus projekt“.',
    newProject: 'Uus projekt',
    create: 'Loo projekt',
    cancel: 'Tühista',
    pending: 'Palun oota…',
    name: 'Nimi',
    namePlaceholder: 'nt Õie tänav 5',
    client: 'Klient',
    address: 'Aadress',
    taxRate: 'Käibemaksumäär (%)',
    nameRequired: 'Sisesta projekti nimi.',
    delete: 'Kustuta',
    deleteLabel: (name: string) => `Kustuta projekt ${name}`,
    deleteTitle: 'Kustuta projekt?',
    deleteText: (name: string) => `Projekt „${name}“ ja kõik selle read kustutatakse. Seda ei saa tagasi võtta.`,
  },
  project: {
    fallbackTitle: 'Projekt',
    downloadExcel: 'Laadi alla Excel',
  },
  table: {
    columns: {
      no: 'Nr',
      description: 'Kirjeldus',
      calcType: 'Arvutus',
      quantity: 'Kogus',
      unit: 'Ühik',
      unitPrice: 'Ühiku hind',
      percent: 'Protsent',
      total: 'Summa',
      actions: 'Toimingud',
    },
    calcTypes: {
      fixed: 'Kindel summa',
      qty_price: 'Kogus × hind',
      percent: '% ülalolevatest ridadest',
    },
    percentSuffix: '% ülalolevatest',
    descriptionPlaceholder: 'nt Seinte värvimine',
    unitPlaceholder: 'm², h, tk',
    rowLabel: (no: number) => `rida ${no}`,
    empty: 'Tabelis pole veel ridu. Alusta nupuga „Lisa rida“.',
    addRow: 'Lisa rida',
    saving: 'Salvestan…',
    saved: 'Salvestatud',
    moveUp: 'Liiguta üles',
    moveDown: 'Liiguta alla',
    moreActions: 'Rohkem valikuid',
    duplicate: 'Tee koopia',
    delete: 'Kustuta',
    invalidNumber: (decimals: number) => `Sisesta number, kuni ${decimals} kohta pärast koma (nt 12,50)`,
    negativeSubtotal: 'Vahesumma on alla nulli. Kontrolli allahindlusi.',
    totals: xlsx.totals,
  },
} as const;
