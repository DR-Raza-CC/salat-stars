// Salat Stars — daily content. Edit freely.
// Sayings of Imam Ali (as) from Nahj al-Balagha (Sayings / Hikam section, Sharif al-Radi numbering).
// Text is our own plain-English rendering in two levels: `kid` (ages 8–11) and `full` (12+ / adults).
// Numbers were checked against thaqalayn.net / balagha.app (Nov 2026). Each links to the saying.
export const sayingLink = n => `https://thaqalayn.net/chapter/32/3/${n}`;

export const SAYINGS = [
  { n: 4, kid: 'Being patient is a kind of bravery.', full: 'Helplessness is a calamity; patience is courage; doing without is wealth; self-restraint is a shield; and the best companion is being content with what Allah decrees.' },
  { n: 6, kid: 'A smile is the key to friendship.', full: 'The heart of the wise keeps his secrets safe; cheerfulness ties friendships together; and patience buries many faults.' },
  { n: 10, kid: 'Be so kind that people always want you around.', full: 'Live among people in such a way that if you die they weep for you, and while you live they long for your company.' },
  { n: 39, kid: 'Extra prayers don\'t count if you skip your wajib prayers.', full: 'Optional worship cannot bring you closer to Allah if it gets in the way of what is obligatory.' },
  { n: 40, kid: 'Think first, then speak.', full: 'The tongue of the wise is behind his heart, and the heart of the foolish is behind his tongue.' },
  { n: 46, kid: 'Feeling sorry for a mistake is better than showing off a good deed.', full: 'A sin that makes you feel sorry is better with Allah than a good deed that makes you proud.' },
  { n: 52, kid: 'The strongest people are the ones who forgive.', full: 'The one most able to forgive is the one who is most able to punish.' },
  { n: 53, kid: 'Real generosity is giving before anyone asks.', full: 'True generosity is giving of your own accord; giving only when asked may come from shame or fear of blame.' },
  { n: 54, kid: 'Wisdom is the best treasure. Good manners are the best gift.', full: 'There is no wealth like wisdom, no poverty like ignorance, no inheritance like good manners, and no support like taking advice.' },
  { n: 55, kid: 'Patience means waiting nicely AND saying no to things that are bad for you.', full: 'Patience is of two kinds: patience with what hurts you, and patience in holding back from what you crave.' },
  { n: 57, kid: 'Being happy with what you have is a treasure that never runs out.', full: 'Contentment is a wealth that never runs out.' },
  { n: 59, kid: 'Someone who warns you is really helping you.', full: 'The one who warns you is like the one who brings you good news.' },
  { n: 60, kid: 'Words can bite — be careful with your tongue!', full: 'The tongue is a wild animal: let it loose and it will tear into things.' },
  { n: 62, kid: 'When someone greets you, greet them back even better!', full: 'When you are greeted, return an even better greeting; when someone does you a favour, repay it with more — though the credit stays with the one who began.' },
  { n: 65, kid: 'Look after your friends — life is lonely without them.', full: 'Having no friends is like living in a strange land.' },
  { n: 67, kid: 'Never be shy to give a little. Giving nothing is smaller.', full: 'Do not be ashamed of giving little, because refusing to give is even less.' },
  { n: 68, kid: 'Saying "Alhamdulillah" makes good things even more beautiful.', full: 'Self-respect is the adornment of the poor, and gratitude is the adornment of the rich.' },
  { n: 71, kid: 'Clever people talk less and listen more.', full: 'As wisdom grows, talk grows less.' },
  { n: 73, kid: 'Before you tell others what to do, do it yourself.', full: 'Whoever sets himself up to lead people should teach himself before teaching others, and teach by his example before his words.' },
  { n: 81, kid: 'You are worth what you learn and do well.', full: 'The worth of every person lies in what they do well.' },
  { n: 82, kid: 'Hope only in Allah, never be shy to say "I don\'t know", and keep learning!', full: 'Five things are worth any journey: hope only in your Lord; fear only your sins; never be ashamed to say "I don\'t know"; never be ashamed to learn; and be patient — patience is to faith what the head is to the body.' },
  { n: 136, kid: 'Salat brings every good person closer to Allah.', full: 'Prayer is the way every God-conscious person draws near to Allah; fasting is the zakat of the body.' },
  { n: 148, kid: 'People get to know the real you by how you speak.', full: 'A person is hidden beneath his tongue.' },
  { n: 252, kid: 'Allah gave us salat to keep us humble and kind.', full: 'Allah made faith a cleansing from shirk, and prayer a cleansing from arrogance; fasting a test of sincerity, and the Hajj a strengthening of the religion.' },
  { n: 349, kid: 'Fix your own mistakes before pointing at others.', full: 'Whoever looks at his own faults is too busy to look at the faults of others.' },
  { n: 381, kid: 'Once words are out, you can\'t take them back.', full: 'Your words are in your control until you speak them; once spoken, you are in their control. Guard your tongue as you guard your gold and silver.' },
  { n: 392, kid: 'Speak up kindly so people can know the real you.', full: 'Speak, so that you may be known, for a person is hidden beneath his tongue.' },
  { n: 407, kid: 'Wisdom is like a rescue boat — it will save you one day.', full: 'Allah does not give a person wisdom except that one day He will rescue him by it.' },
  { n: 410, kid: 'Remembering Allah is the best thing about a person.', full: 'Taqwa — mindfulness of Allah — is the crown of all good character.' },
  { n: 412, kid: 'Don\'t do to others what you don\'t like them doing to you.', full: 'It is enough discipline for yourself to avoid what you dislike seeing in others.' },
  { n: 422, kid: 'Do good, and never think a good deed is too small.', full: 'Do good and do not think any of it small, for the small of it is great and the little of it is much.' },
  { n: 433, kid: 'Fun things end, but what we do stays with us.', full: 'Remember that pleasures pass away while their consequences remain.' },
  { n: 438, kid: 'People often dislike things just because they don\'t know them yet.', full: 'People are enemies of what they do not know.' },
  { n: 444, kid: 'A little every day is better than a lot once.', full: 'A little that lasts is better than a lot that wears you out.' },
  { n: 457, kid: 'Someone who loves learning never gets bored of it.', full: 'Two kinds of hungry people are never full: the seeker of knowledge and the seeker of this world.' },
  { n: 458, kid: 'Always tell the truth, even when it\'s hard.', full: 'Faith is choosing the truth when it harms you over a lie that benefits you.' },
  { n: 471, kid: 'Speak when it\'s wise; stay quiet when you don\'t know.', full: 'There is no good in silence when wisdom is needed, and no good in speech that comes from ignorance.' },
  { n: 475, kid: 'Being thankful for what you have makes you rich inside.', full: 'Contentment is a wealth that is never used up.' },
  { n: 478, kid: 'If you know something good, teach it to others!', full: 'Allah did not make it a duty on the ignorant to learn until He had made it a duty on the learned to teach.' }
];

// Words of wisdom from the Ahlulbayt (as). Sources are given by book; please check against your
// own copy or ask your 'alim before relying on exact wording. Edit or add to this list freely.
export const WISDOM = [
  { who: 'The Holy Prophet (saww)', kid: 'I leave you two precious things: the Quran and my Ahlulbayt. Hold on to both!', full: 'I leave among you two weighty things: the Book of Allah and my family, my Ahlulbayt. As long as you hold to both you will never go astray.', src: 'Hadith al-Thaqalayn — al-Kafi; also Sahih Muslim' },
  { who: 'The Holy Prophet (saww)', kid: 'Husain is from me and I am from Husain.', full: 'Husain is from me and I am from Husain. Allah loves whoever loves Husain.', src: 'Kamil al-Ziyarat; Sunan al-Tirmidhi' },
  { who: 'Sayyida Fatima al-Zahra (sa)', kid: 'Allah gave us salat to keep pride out of our hearts.', full: 'Allah made faith a purification from shirk, and prayer a means to keep you far from arrogance.', src: 'Her sermon of Fadak (al-Khutba al-Fadakiyya)' },
  { who: 'Imam Husain (as)', kid: 'On Ashura, even in the middle of the battle, Imam Husain stopped to pray Dhuhr.', full: 'On the day of Ashura, when a companion reminded him that the time of Dhuhr had come, Imam Husain (as) prayed for him and led the prayer on the battlefield.', src: 'Maqatil (historical accounts of Karbala), e.g. Tarikh al-Tabari' },
  { who: 'Imam Zayn al-Abidin (as)', kid: 'Ask Allah to help you be gentle and kind to your parents.', full: 'In his supplication for his parents he asks Allah to make him hold them in awe and treat them with gentleness, and to make his obedience to them sweeter to him than sleep to the drowsy.', src: 'al-Sahifa al-Sajjadiyya, Dua 24' },
  { who: 'Imam al-Baqir (as)', kid: 'Salat is the first thing we\'ll be asked about.', full: 'The first thing a servant will be held to account for is the prayer: if it is accepted, everything else is accepted.', src: 'al-Kafi, Book of Prayer' },
  { who: 'Imam al-Sadiq (as)', kid: 'Tasbih of Sayyida Fatima after every salat is super special!', full: 'The Tasbih of Fatima al-Zahra (as) after every prayer is dearer to me than praying a thousand rak\'ahs every day.', src: 'al-Kafi, Book of Prayer' },
  { who: 'Imam al-Sadiq (as)', kid: 'Never treat salat as unimportant.', full: 'Our intercession will not reach the one who takes prayer lightly.', src: 'al-Kafi, Book of Prayer' },
  { who: 'Imam al-Sadiq (as)', kid: 'Make the Ahlulbayt proud of you!', full: 'Be an adornment for us, and do not be a disgrace upon us.', src: 'al-Amali, Shaykh al-Saduq' },
  { who: 'Imam al-Sadiq (as)', kid: 'You can tell a true follower by how they look after their salat.', full: 'Test our Shia at the times of prayer — how they guard them.', src: 'al-Khisal, Shaykh al-Saduq' },
  { who: 'Imam al-Kadhim (as)', kid: 'Split your day: time for Allah, time for work, time for family and friends, and time to relax.', full: 'Try to divide your time into four parts: a time for speaking with Allah, a time for earning a living, a time for trusted friends, and a time for lawful enjoyment — which gives you strength for the other three.', src: 'Tuhaf al-Uqul' }
];

// Important dates in the Shia calendar (Hijri month, day). type: eid | birth | martyrdom | event
export const CALENDAR = [
  { hm: 1, hd: 1, t: 'event', name: 'Islamic New Year — Muharram begins' },
  { hm: 1, hd: 10, t: 'martyrdom', name: 'Ashura — Martyrdom of Imam Husain (as) at Karbala' },
  { hm: 1, hd: 25, t: 'martyrdom', name: 'Martyrdom of Imam Zayn al-Abidin (as)' },
  { hm: 2, hd: 7, t: 'birth', name: 'Birth of Imam Musa al-Kadhim (as)' },
  { hm: 2, hd: 20, t: 'martyrdom', name: 'Arba\'een of Imam Husain (as)' },
  { hm: 2, hd: 28, t: 'martyrdom', name: 'Passing of the Holy Prophet (saww) and Martyrdom of Imam Hasan (as)' },
  { hm: 2, hd: 29, t: 'martyrdom', name: 'Martyrdom of Imam Ali al-Ridha (as)' },
  { hm: 3, hd: 8, t: 'martyrdom', name: 'Martyrdom of Imam Hasan al-Askari (as)' },
  { hm: 3, hd: 9, t: 'event', name: 'Beginning of the Imamate of Imam al-Mahdi (ajtf)' },
  { hm: 3, hd: 17, t: 'birth', name: 'Birth of the Holy Prophet (saww) and Imam Ja\'far al-Sadiq (as)' },
  { hm: 4, hd: 8, t: 'birth', name: 'Birth of Imam Hasan al-Askari (as)' },
  { hm: 5, hd: 5, t: 'birth', name: 'Birth of Sayyida Zaynab (sa)' },
  { hm: 5, hd: 13, t: 'martyrdom', name: 'Ayyam-e-Fatimiyya begin — Martyrdom of Sayyida Fatima (sa) (first narration)' },
  { hm: 6, hd: 3, t: 'martyrdom', name: 'Martyrdom of Sayyida Fatima al-Zahra (sa)' },
  { hm: 6, hd: 20, t: 'birth', name: 'Birth of Sayyida Fatima al-Zahra (sa)' },
  { hm: 7, hd: 1, t: 'birth', name: 'Birth of Imam Muhammad al-Baqir (as)' },
  { hm: 7, hd: 3, t: 'martyrdom', name: 'Martyrdom of Imam Ali al-Hadi (as)' },
  { hm: 7, hd: 10, t: 'birth', name: 'Birth of Imam Muhammad al-Jawad (as)' },
  { hm: 7, hd: 13, t: 'birth', name: 'Birth of Imam Ali (as) inside the Holy Ka\'bah' },
  { hm: 7, hd: 15, t: 'martyrdom', name: 'Passing of Sayyida Zaynab (sa)' },
  { hm: 7, hd: 25, t: 'martyrdom', name: 'Martyrdom of Imam Musa al-Kadhim (as)' },
  { hm: 7, hd: 27, t: 'eid', name: 'Eid al-Mab\'ath — the Prophet (saww) receives his mission' },
  { hm: 8, hd: 3, t: 'birth', name: 'Birth of Imam Husain (as)' },
  { hm: 8, hd: 4, t: 'birth', name: 'Birth of Hazrat Abbas (as)' },
  { hm: 8, hd: 5, t: 'birth', name: 'Birth of Imam Zayn al-Abidin (as)' },
  { hm: 8, hd: 11, t: 'birth', name: 'Birth of Hazrat Ali al-Akbar (as)' },
  { hm: 8, hd: 15, t: 'birth', name: 'Birth of Imam al-Mahdi (ajtf) — Night of Bara\'at' },
  { hm: 9, hd: 1, t: 'event', name: 'Holy month of Ramadhan begins' },
  { hm: 9, hd: 15, t: 'birth', name: 'Birth of Imam Hasan al-Mujtaba (as)' },
  { hm: 9, hd: 19, t: 'martyrdom', name: 'Imam Ali (as) struck in the mihrab — Night of Qadr' },
  { hm: 9, hd: 21, t: 'martyrdom', name: 'Martyrdom of Imam Ali (as) — Night of Qadr' },
  { hm: 9, hd: 23, t: 'event', name: 'Laylat al-Qadr (23rd night)' },
  { hm: 10, hd: 1, t: 'eid', name: 'Eid al-Fitr' },
  { hm: 10, hd: 25, t: 'martyrdom', name: 'Martyrdom of Imam Ja\'far al-Sadiq (as)' },
  { hm: 11, hd: 1, t: 'birth', name: 'Birth of Sayyida Fatima al-Ma\'sooma (sa)' },
  { hm: 11, hd: 11, t: 'birth', name: 'Birth of Imam Ali al-Ridha (as)' },
  { hm: 11, hd: 29, t: 'martyrdom', name: 'Martyrdom of Imam Muhammad al-Jawad (as)' },
  { hm: 12, hd: 7, t: 'martyrdom', name: 'Martyrdom of Imam Muhammad al-Baqir (as)' },
  { hm: 12, hd: 9, t: 'event', name: 'Day of Arafah — Dua Arafah of Imam Husain (as)' },
  { hm: 12, hd: 10, t: 'eid', name: 'Eid al-Adha' },
  { hm: 12, hd: 15, t: 'birth', name: 'Birth of Imam Ali al-Hadi (as)' },
  { hm: 12, hd: 18, t: 'eid', name: 'Eid al-Ghadir — the Prophet (saww) declares Imam Ali (as) as Mawla' },
  { hm: 12, hd: 24, t: 'eid', name: 'Eid al-Mubahila' }
];

// Mourning: 1 Muharram → 8 Rabi' al-Awwal, plus every martyrdom day. No confetti then.
export function isMourning(h) {
  if (h.hm === 1 || h.hm === 2) return true;
  if (h.hm === 3 && h.hd <= 8) return true;
  return CALENDAR.some(e => e.t === 'martyrdom' && e.hm === h.hm && e.hd === h.hd);
}
export const isRamadhan = h => h.hm === 9;
export const eventsOn = h => CALENDAR.filter(e => e.hm === h.hm && e.hd === h.hd);

export const ZAHRA_TRUST_URL = 'https://www.zahratrust.com/';
export const SISTANI_RULING_URL = 'https://www.sistani.org/english/book/48/2355/';
export const SISTANI_QA_URL = 'https://www.sistani.org/english/qa/15596/';

// Extras that earn +1 each after a prayer
export const EXTRAS = [
  { id: 'azaan', label: 'Azaan', icon: '📢' },
  { id: 'iqamah', label: 'Iqamah', icon: '🕌' },
  { id: 'tasbih', label: 'Tasbih of Sayyida Fatima (sa)', icon: '📿' },
  { id: 'quran', label: 'A verse of the Quran', icon: '📖' }
];
export const JAMAAT_BONUS = 2;
