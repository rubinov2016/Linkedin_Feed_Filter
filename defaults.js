// Shared defaults for content script, options page and popup.
// Everything here is editable in the options page; this is only the seed.

const LFF_DEFAULTS = {
  enabled: true,

  // ---- Hide behaviour ------------------------------------------------
  hideMode: "collapse",          // "collapse" (one-line stub with "show") | "remove"
  hidePromoted: true,            // Promoted / sponsored posts
  hideSuggested: false,          // "Suggested" posts from accounts you do not follow

  // ---- 1. Gender filter ----------------------------------------------
  genderFilter: {
    enabled: true,
    skip: { male: false, female: true, other: false, unknown: false },
    usePronouns: true,           // "She/Her", "He/Him" next to the name
    useNameLists: true,          // first-name lists below
    useRuSuffix: true,           // Russian names ending in -а / -я / -ия -> female (unless in male list)
    useAvatarFace: true,         // classify face gender on the profile photo
    avatarMinConfidence: 0.80    // 0..1, below -> unknown
  },
  maleNames: [
    // EN
    "james","john","robert","michael","william","david","richard","joseph","thomas","charles","christopher","daniel",
    "matthew","anthony","mark","donald","steven","paul","andrew","joshua","kenneth","kevin","brian","george","timothy",
    "ronald","edward","jason","jeffrey","ryan","jacob","gary","nicholas","eric","jonathan","stephen","larry","justin",
    "scott","brandon","benjamin","samuel","gregory","alexander","frank","patrick","raymond","jack","dennis","jerry",
    "tyler","aaron","jose","adam","nathan","henry","douglas","zachary","peter","kyle","noah","ethan","jeremy","walter",
    "christian","keith","roger","terry","austin","sean","gerald","carl","harold","dylan","arthur","lawrence","jordan",
    "jesse","bryan","billy","bruce","gabriel","joe","logan","alan","juan","albert","willie","elijah","wayne","randy",
    "vincent","mason","roy","ralph","bobby","russell","bradley","philip","eugene","tom","tim","mike","dave","steve",
    "chris","nick","alex","max","oliver","harry","oscar","leo","liam","lucas","hugo","felix","simon","martin","stefan",
    "andreas","thomas","jan","lars","erik","sven","nils","marco","luca","matteo","pablo","diego","javier","carlos",
    "miguel","rafael","ahmed","mohammed","omar","ali","hassan","raj","amit","rahul","vikram","arjun","wei","jun","hiroshi",
    "kenji","takeshi","yuki","sergey","sergei","dmitry","dmitri","ivan","alexey","aleksey","alexei","andrey","andrei",
    "vladimir","nikolay","nikolai","mikhail","pavel","igor","oleg","konstantin","anton","artem","artyom","denis","evgeny",
    "evgeniy","yevgeny","kirill","maxim","roman","ruslan","stanislav","vadim","victor","viktor","vitaly","vitaliy",
    "vyacheslav","yuri","yury","boris","gleb","ilya","leonid","timur","fedor","fyodor","grigory","arseny","egor","yegor",
    "nikita","semyon","taras","bogdan","vasily","valery","valeriy","eduard","georgy","georgiy","rustam","renat","marat",
    // RU
    "александр","алексей","андрей","антон","артем","артём","борис","вадим","валерий","василий","виктор","виталий",
    "владимир","владислав","вячеслав","геннадий","георгий","глеб","григорий","даниил","данил","денис","дмитрий","евгений",
    "егор","иван","игорь","илья","кирилл","константин","леонид","максим","марат","михаил","никита","николай","олег",
    "павел","петр","пётр","роман","руслан","сергей","станислав","степан","тимур","федор","фёдор","юрий","ярослав",
    "арсений","богдан","валентин","всеволод","матвей","марк","лев","семен","семён","тарас","эдуард","рустам","ренат"
  ],
  femaleNames: [
    // EN
    "mary","patricia","jennifer","linda","elizabeth","barbara","susan","jessica","sarah","karen","lisa","nancy","betty",
    "margaret","sandra","ashley","kimberly","emily","donna","michelle","carol","amanda","dorothy","melissa","deborah",
    "stephanie","rebecca","sharon","laura","cynthia","kathleen","amy","angela","shirley","anna","brenda","pamela","emma",
    "nicole","helen","samantha","katherine","christine","debra","rachel","carolyn","janet","catherine","maria","heather",
    "diane","ruth","julie","olivia","joyce","virginia","victoria","kelly","lauren","christina","joan","evelyn","judith",
    "megan","andrea","cheryl","hannah","jacqueline","martha","gloria","teresa","ann","sara","madison","frances","kathryn",
    "janice","jean","abigail","alice","judy","sophia","grace","denise","amber","doris","marilyn","danielle","beverly",
    "isabella","theresa","diana","natalie","brittany","charlotte","marie","kayla","alexis","lori","kate","katie","jane",
    "julia","sophie","chloe","lucy","ella","mia","ava","zoe","lily","amelia","isabel","isabelle","clara","eva","lena",
    "lea","nina","sofia","sofie","mila","sara","laura","paula","carla","lucia","ines","marta","ana","carmen","elena",
    "irina","svetlana","natalia","natalya","olga","tatiana","tatyana","ekaterina","katerina","yekaterina","anastasia",
    "maria","mariya","daria","darya","polina","ksenia","kseniya","oksana","yulia","julia","iuliia","alina","alena",
    "alyona","anna","vera","nadezhda","lyudmila","ludmila","galina","larisa","marina","valentina","veronika","viktoria",
    "victoria","kristina","evgenia","evgeniya","zhanna","margarita","elizaveta","sofya","sofia","varvara","yana","inna",
    "diana","angelina","karina","regina","dina","alla","lidia","lidiya","nelli","elvira","aigul","gulnara","priya",
    "anjali","neha","pooja","fatima","aisha","layla","mei","ling","yuki","sakura","hana","aiko",
    // RU
    "александра","алена","алёна","алина","алла","анастасия","ангелина","анна","антонина","валентина","валерия","варвара",
    "вера","вероника","виктория","галина","дарья","диана","евгения","екатерина","елена","елизавета","жанна","зоя",
    "инна","ирина","карина","кира","кристина","ксения","лариса","лидия","лилия","любовь","людмила","майя","маргарита",
    "марина","мария","надежда","наталия","наталья","нина","оксана","ольга","полина","регина","светлана","софия","софья",
    "тамара","татьяна","ульяна","юлия","яна","элина","эльвира","эмилия","алиса","василиса","злата","милана","ева"
  ],

  // ---- 2. Profession / keyword filter --------------------------------
  keywordFilter: {
    enabled: true,
    matchMode: "substring",      // "substring" | "word"
    fields: { headline: true, name: false, text: false, company: false }
  },
  keywords: [
    "hr", "human resources", "hrbp", "hr business partner", "people partner", "people & culture", "people and culture",
    "recruiter", "recruiting", "recruitment", "talent acquisition", "talent partner", "sourcer", "headhunter",
    "career coach", "life coach", "mindset coach", "executive coach", "motivational speaker",
    "эйчар", "рекрутер", "рекрутинг", "подбор персонала", "hr-директор", "hr директор", "карьерный консультант", "коуч"
  ],

  // ---- 3. Photo filter ------------------------------------------------
  photoFilter: {
    enabled: true,
    mode: "match",               // "match": face gender == author gender | "anyFace": any face | "anyImage": any image post
    faceMinConfidence: 0.70,     // gender classification confidence 0..1
    maxImagesPerPost: 3,         // check at most N images per post
    includeVideoThumbs: false
  },

  // ---- 4. Load & condense ---------------------------------------------
  condense: {
    autoStart: false,            // run automatically when the feed opens
    maxSeconds: 60,
    maxPosts: 200,
    scrollPauseMs: 900,          // pause between scroll steps
    resultMode: "remove"         // after condensing: "remove" hidden posts entirely | "collapse" keep stubs
  },

  // ---- Advanced: DOM selectors (LinkedIn changes markup; edit here) ---
  selectors: {
    post: "[data-testid='mainFeed'] div[role='listitem'][componentkey], div[data-id^='urn:li:activity'], div[data-id^='urn:li:aggregate'], div[data-urn^='urn:li:activity'], div.feed-shared-update-v2",
    // New (2026) server-driven UI: class names are obfuscated, so parsing is text-based
    sduiHeader: "[data-sdui-anchor-id^='feed-header']",
    sduiText: "[data-testid='expandable-text-box']",
    actorTitle: ".update-components-actor__title, .update-components-actor__name, .feed-shared-actor__title",
    actorName: ".update-components-actor__title span[aria-hidden='true'], .update-components-actor__name span[aria-hidden='true'], .update-components-actor__single-line-truncate span[aria-hidden='true']",
    actorDescription: ".update-components-actor__description, .feed-shared-actor__description",
    actorSub: ".update-components-actor__sub-description, .feed-shared-actor__sub-description",
    actorAvatar: ".update-components-actor__avatar img, .update-components-actor__avatar-image, .feed-shared-actor__avatar img",
    postText: ".update-components-text, .feed-shared-update-v2__description, .feed-shared-inline-show-more-text",
    postImages: ".update-components-image img, .feed-shared-image img, .update-components-image__image, .update-components-article__image img",
    videoThumbs: ".update-components-linkedin-video img, video[poster]",
    promotedMarker: ".update-components-actor__sub-description, .feed-shared-actor__sub-description",
    suggestedMarker: ".update-components-header__text-view, .feed-shared-header__text-view"
  },

  // Words that mark promoted / suggested posts in the sub-description or header
  promotedWords: ["promoted", "sponsored", "продвигается", "реклама"],
  suggestedWords: ["suggested", "recommended for you", "рекомендуем", "предлагаем"]
};

if (typeof module !== "undefined") module.exports = LFF_DEFAULTS;
