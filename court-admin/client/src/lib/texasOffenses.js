/*
 * Common offenses tried before juries in Irving, Texas (Irving Municipal
 * Court for Class C misdemeanors; Dallas County courts for the rest), as
 * starting points for a count. Elements and definitions follow the Texas
 * Penal Code (PC), Health and Safety Code (HSC) and Transportation Code
 * (TC). Choosing one fills in the count; the clerk then matches it to the
 * judge's written charge, which always governs.
 */

const VENUE = 'The offense happened on or about the date alleged, in the City of Irving, Dallas County, Texas.'

// Texas Penal Code §1.07 and §6.03 definitions, shared by many offenses.
const D = {
  intentionally: { term: 'Intentionally', text: 'A person acts intentionally, or with intent, with respect to the nature of his conduct or to a result of his conduct when it is his conscious objective or desire to engage in the conduct or cause the result. (PC §6.03(a))' },
  knowingly: { term: 'Knowingly', text: 'A person acts knowingly, or with knowledge, with respect to the nature of his conduct or to circumstances surrounding his conduct when he is aware of the nature of his conduct or that the circumstances exist. A person acts knowingly, or with knowledge, with respect to a result of his conduct when he is aware that his conduct is reasonably certain to cause the result. (PC §6.03(b))' },
  recklessly: { term: 'Recklessly', text: 'A person acts recklessly, or is reckless, with respect to circumstances surrounding his conduct or the result of his conduct when he is aware of but consciously disregards a substantial and unjustifiable risk that the circumstances exist or the result will occur. The risk must be of such a nature and degree that its disregard constitutes a gross deviation from the standard of care that an ordinary person would exercise under all the circumstances as viewed from the actor’s standpoint. (PC §6.03(c))' },
  bodilyInjury: { term: 'Bodily injury', text: 'Physical pain, illness, or any impairment of physical condition. (PC §1.07(a)(8))' },
  seriousBodilyInjury: { term: 'Serious bodily injury', text: 'Bodily injury that creates a substantial risk of death or that causes death, serious permanent disfigurement, or protracted loss or impairment of the function of any bodily member or organ. (PC §1.07(a)(46))' },
  deadlyWeapon: { term: 'Deadly weapon', text: '(A) A firearm or anything manifestly designed, made, or adapted for the purpose of inflicting death or serious bodily injury; or (B) anything that in the manner of its use or intended use is capable of causing death or serious bodily injury. (PC §1.07(a)(17))' },
  effectiveConsent: { term: 'Effective consent', text: 'Includes consent by a person legally authorized to act for the owner. Consent is not effective if induced by deception or coercion. (PC §1.07(a)(19))' },
  owner: { term: 'Owner', text: 'A person who has title to the property, possession of the property, whether lawful or not, or a greater right to possession of the property than the actor. (PC §1.07(a)(35))' },
  publicPlace: { term: 'Public place', text: 'Any place to which the public or a substantial group of the public has access, and includes, but is not limited to, streets, highways, and the common areas of schools, hospitals, apartment houses, office buildings, transport facilities, and shops. (PC §1.07(a)(40))' },
  intoxicated: { term: 'Intoxicated', text: '(A) Not having the normal use of mental or physical faculties by reason of the introduction of alcohol, a controlled substance, a drug, a dangerous drug, a combination of two or more of those substances, or any other substance into the body; or (B) having an alcohol concentration of 0.08 or more. (PC §49.01(2))' },
  peaceOfficer: { term: 'Peace officer', text: 'A person elected, employed, or appointed as a peace officer under Article 2.12, Code of Criminal Procedure, or other law. (PC §1.07(a)(36))' },
  possession: { term: 'Possession', text: 'Actual care, custody, control, or management. (PC §1.07(a)(39))' },
  appropriate: { term: 'Appropriate', text: '(A) To bring about a transfer or purported transfer of title to or other nonpossessory interest in property, whether to the actor or another; or (B) to acquire or otherwise exercise control over property other than real property. (PC §31.01(4))' },
  deprive: { term: 'Deprive', text: '(A) To withhold property from the owner permanently or for so extended a period of time that a major portion of the value or enjoyment of the property is lost to the owner; (B) to restore property only upon payment of reward or other compensation; or (C) to dispose of property in a manner that makes recovery of the property by the owner unlikely. (PC §31.01(2))' },
  habitation: { term: 'Habitation', text: 'A structure or vehicle that is adapted for the overnight accommodation of persons, and includes each separately secured or occupied portion of the structure or vehicle, and each structure appurtenant to or connected with the structure or vehicle. (PC §30.01(1))' },
  enter: { term: 'Enter', text: 'To intrude any part of the body, or any physical object connected with the body. (PC §30.02(b), §30.04(b))' },
}

export const TEXAS_OFFENSES = [
  /* ── Assaultive offenses ── */
  {
    key: 'pc-22.01-a1', group: 'Assaultive offenses', name: 'Assault Causing Bodily Injury', statute: 'Texas Penal Code §22.01(a)(1)',
    summary: 'The defendant is charged with intentionally, knowingly, or recklessly causing bodily injury to another person.',
    elements: [VENUE, 'The defendant caused bodily injury to the complainant.', 'The defendant did so intentionally, knowingly, or recklessly.'],
    definitions: [D.bodilyInjury, D.intentionally, D.knowingly, D.recklessly],
  },
  {
    key: 'pc-22.01-a1-fv', group: 'Assaultive offenses', name: 'Assault Causing Bodily Injury – Family Violence', statute: 'Texas Penal Code §22.01(a)(1), (b)(2)',
    summary: 'The defendant is charged with intentionally, knowingly, or recklessly causing bodily injury to a family or household member, or a person in a dating relationship with the defendant.',
    elements: [VENUE, 'The defendant caused bodily injury to the complainant.', 'The defendant did so intentionally, knowingly, or recklessly.', 'The complainant was a member of the defendant’s family or household, or was in a dating relationship with the defendant.'],
    definitions: [D.bodilyInjury, D.intentionally, D.knowingly, D.recklessly],
  },
  {
    key: 'pc-22.01-a2', group: 'Assaultive offenses', name: 'Assault by Threat', statute: 'Texas Penal Code §22.01(a)(2)',
    summary: 'The defendant is charged with intentionally or knowingly threatening another person with imminent bodily injury.',
    elements: [VENUE, 'The defendant threatened the complainant with imminent bodily injury.', 'The defendant did so intentionally or knowingly.'],
    definitions: [D.bodilyInjury, D.intentionally, D.knowingly],
  },
  {
    key: 'pc-22.01-a3', group: 'Assaultive offenses', name: 'Assault by Offensive Contact', statute: 'Texas Penal Code §22.01(a)(3)',
    summary: 'The defendant is charged with intentionally or knowingly causing physical contact with another person that the defendant knew or should reasonably have believed the person would regard as offensive or provocative.',
    elements: [VENUE, 'The defendant caused physical contact with the complainant.', 'The defendant did so intentionally or knowingly.', 'The defendant knew or should reasonably have believed that the complainant would regard the contact as offensive or provocative.'],
    definitions: [D.intentionally, D.knowingly],
  },
  {
    key: 'pc-22.02', group: 'Assaultive offenses', name: 'Aggravated Assault', statute: 'Texas Penal Code §22.02(a)',
    summary: 'The defendant is charged with committing assault and either causing serious bodily injury or using or exhibiting a deadly weapon during the assault.',
    elements: [VENUE, 'The defendant intentionally, knowingly, or recklessly caused bodily injury to the complainant, or intentionally or knowingly threatened the complainant with imminent bodily injury.', 'The defendant caused serious bodily injury to the complainant, or used or exhibited a deadly weapon during the assault.'],
    definitions: [D.bodilyInjury, D.seriousBodilyInjury, D.deadlyWeapon, D.intentionally, D.knowingly, D.recklessly],
  },
  {
    key: 'pc-22.05', group: 'Assaultive offenses', name: 'Deadly Conduct', statute: 'Texas Penal Code §22.05(a)',
    summary: 'The defendant is charged with recklessly engaging in conduct that placed another person in imminent danger of serious bodily injury.',
    elements: [VENUE, 'The defendant engaged in conduct that placed the complainant in imminent danger of serious bodily injury.', 'The defendant did so recklessly.'],
    definitions: [D.seriousBodilyInjury, D.recklessly],
  },
  {
    key: 'pc-22.07', group: 'Assaultive offenses', name: 'Terroristic Threat', statute: 'Texas Penal Code §22.07(a)(2)',
    summary: 'The defendant is charged with threatening to commit an offense involving violence to a person or property, with intent to place a person in fear of imminent serious bodily injury.',
    elements: [VENUE, 'The defendant threatened to commit an offense involving violence to a person or property.', 'The defendant intended to place the complainant in fear of imminent serious bodily injury.'],
    definitions: [D.seriousBodilyInjury, D.intentionally],
  },
  {
    key: 'pc-29.02', group: 'Assaultive offenses', name: 'Robbery', statute: 'Texas Penal Code §29.02(a)',
    summary: 'The defendant is charged with causing bodily injury to, or threatening, another person while committing theft and intending to obtain or keep control of the property.',
    elements: [VENUE, 'The defendant was in the course of committing theft of property.', 'The defendant intended to obtain or maintain control of the property.', 'The defendant intentionally, knowingly, or recklessly caused bodily injury to the complainant, or intentionally or knowingly threatened or placed the complainant in fear of imminent bodily injury or death.'],
    definitions: [{ term: 'In the course of committing theft', text: 'Conduct that occurs in an attempt to commit, during the commission, or in immediate flight after the attempt or commission of theft. (PC §29.01(1))' }, D.bodilyInjury, D.appropriate, D.deprive, D.intentionally, D.knowingly, D.recklessly],
  },
  {
    key: 'pc-29.03', group: 'Assaultive offenses', name: 'Aggravated Robbery (Deadly Weapon)', statute: 'Texas Penal Code §29.03(a)(2)',
    summary: 'The defendant is charged with committing robbery while using or exhibiting a deadly weapon.',
    elements: [VENUE, 'The defendant was in the course of committing theft of property, intending to obtain or maintain control of the property.', 'The defendant intentionally, knowingly, or recklessly caused bodily injury to the complainant, or intentionally or knowingly threatened or placed the complainant in fear of imminent bodily injury or death.', 'The defendant used or exhibited a deadly weapon.'],
    definitions: [{ term: 'In the course of committing theft', text: 'Conduct that occurs in an attempt to commit, during the commission, or in immediate flight after the attempt or commission of theft. (PC §29.01(1))' }, D.deadlyWeapon, D.bodilyInjury, D.intentionally, D.knowingly, D.recklessly],
  },

  /* ── Homicide ── */
  {
    key: 'pc-19.02', group: 'Homicide', name: 'Murder', statute: 'Texas Penal Code §19.02(b)(1)',
    summary: 'The defendant is charged with intentionally or knowingly causing the death of an individual.',
    elements: [VENUE, 'The defendant caused the death of the complainant.', 'The defendant did so intentionally or knowingly.'],
    definitions: [D.intentionally, D.knowingly],
  },
  {
    key: 'pc-19.04', group: 'Homicide', name: 'Manslaughter', statute: 'Texas Penal Code §19.04(a)',
    summary: 'The defendant is charged with recklessly causing the death of an individual.',
    elements: [VENUE, 'The defendant caused the death of the complainant.', 'The defendant did so recklessly.'],
    definitions: [D.recklessly],
  },

  /* ── Property offenses ── */
  {
    key: 'pc-31.03', group: 'Property offenses', name: 'Theft', statute: 'Texas Penal Code §31.03(a)',
    summary: 'The defendant is charged with unlawfully appropriating property with intent to deprive the owner of it. The value of the property sets the level of the offense (PC §31.03(e)).',
    elements: [VENUE, 'The defendant appropriated property from its owner.', 'The appropriation was without the owner’s effective consent.', 'The defendant intended to deprive the owner of the property.', 'The value of the property was within the range alleged.'],
    definitions: [D.appropriate, D.deprive, D.owner, D.effectiveConsent, D.intentionally],
  },
  {
    key: 'pc-31.07', group: 'Property offenses', name: 'Unauthorized Use of a Vehicle', statute: 'Texas Penal Code §31.07(a)',
    summary: 'The defendant is charged with intentionally or knowingly operating another person’s motor-propelled vehicle without the owner’s effective consent.',
    elements: [VENUE, 'The defendant operated a motor-propelled vehicle belonging to another.', 'The defendant did so without the effective consent of the owner.', 'The defendant did so intentionally or knowingly.'],
    definitions: [D.owner, D.effectiveConsent, D.intentionally, D.knowingly],
  },
  {
    key: 'pc-30.02', group: 'Property offenses', name: 'Burglary of a Habitation', statute: 'Texas Penal Code §30.02(a)(1)',
    summary: 'The defendant is charged with entering a habitation without the owner’s effective consent, intending to commit a felony, theft, or an assault.',
    elements: [VENUE, 'The defendant entered a habitation.', 'The defendant did so without the effective consent of the owner.', 'When entering, the defendant intended to commit a felony, theft, or an assault.'],
    definitions: [D.habitation, D.enter, D.owner, D.effectiveConsent, D.intentionally],
  },
  {
    key: 'pc-30.02-b', group: 'Property offenses', name: 'Burglary of a Building', statute: 'Texas Penal Code §30.02(a)(1)',
    summary: 'The defendant is charged with entering a building, or a part of it not then open to the public, without the owner’s effective consent, intending to commit a felony, theft, or an assault.',
    elements: [VENUE, 'The defendant entered a building, or a portion of a building not then open to the public.', 'The defendant did so without the effective consent of the owner.', 'When entering, the defendant intended to commit a felony, theft, or an assault.'],
    definitions: [{ term: 'Building', text: 'Any enclosed structure intended for use or occupation as a habitation or for some purpose of trade, manufacture, ornament, or use. (PC §30.01(2))' }, D.enter, D.owner, D.effectiveConsent, D.intentionally],
  },
  {
    key: 'pc-30.04', group: 'Property offenses', name: 'Burglary of a Vehicle', statute: 'Texas Penal Code §30.04(a)',
    summary: 'The defendant is charged with breaking into or entering a vehicle without the owner’s effective consent, intending to commit a felony or theft.',
    elements: [VENUE, 'The defendant broke into or entered a vehicle, or a part of a vehicle.', 'The defendant did so without the effective consent of the owner.', 'The defendant intended to commit a felony or theft.'],
    definitions: [D.enter, D.owner, D.effectiveConsent, D.intentionally],
  },
  {
    key: 'pc-30.05', group: 'Property offenses', name: 'Criminal Trespass', statute: 'Texas Penal Code §30.05(a)',
    summary: 'The defendant is charged with entering or remaining on another’s property without effective consent, after notice that entry was forbidden or after being told to leave.',
    elements: [VENUE, 'The defendant entered or remained on or in property of another.', 'The defendant did so without effective consent.', 'The defendant had notice that entry was forbidden, or received notice to depart but failed to do so.'],
    definitions: [{ term: 'Notice', text: 'Includes oral or written communication by the owner or someone with apparent authority to act for the owner; fencing or other enclosure obviously designed to exclude intruders; or a sign posted on the property indicating that entry is forbidden. (PC §30.05(b)(2))' }, D.effectiveConsent],
  },
  {
    key: 'pc-28.03', group: 'Property offenses', name: 'Criminal Mischief', statute: 'Texas Penal Code §28.03(a)(1)',
    summary: 'The defendant is charged with intentionally or knowingly damaging or destroying another’s tangible property without the owner’s effective consent. The amount of loss sets the level of the offense.',
    elements: [VENUE, 'The defendant damaged or destroyed tangible property of the owner.', 'The defendant did so without the effective consent of the owner.', 'The defendant did so intentionally or knowingly.', 'The amount of pecuniary loss was within the range alleged.'],
    definitions: [D.owner, D.effectiveConsent, D.intentionally, D.knowingly],
  },

  /* ── Public order ── */
  {
    key: 'pc-42.01-a1', group: 'Public order', name: 'Disorderly Conduct – Abusive Language', statute: 'Texas Penal Code §42.01(a)(1)',
    summary: 'The defendant is charged with intentionally or knowingly using abusive, indecent, profane, or vulgar language in a public place that by its very utterance tends to incite an immediate breach of the peace.',
    elements: [VENUE, 'The defendant used abusive, indecent, profane, or vulgar language in a public place.', 'The language by its very utterance tended to incite an immediate breach of the peace.', 'The defendant did so intentionally or knowingly.'],
    definitions: [D.publicPlace, D.intentionally, D.knowingly],
  },
  {
    key: 'pc-42.01-a6', group: 'Public order', name: 'Disorderly Conduct – Fighting', statute: 'Texas Penal Code §42.01(a)(6)',
    summary: 'The defendant is charged with intentionally or knowingly fighting with another person in a public place.',
    elements: [VENUE, 'The defendant fought with another person in a public place.', 'The defendant did so intentionally or knowingly.'],
    definitions: [D.publicPlace, D.intentionally, D.knowingly],
  },
  {
    key: 'pc-42.062', group: 'Public order', name: 'Interference with an Emergency Request for Assistance', statute: 'Texas Penal Code §42.062(a)',
    summary: 'The defendant is charged with knowingly preventing or interfering with another person’s ability to place an emergency call or request help.',
    elements: [VENUE, 'The defendant prevented or interfered with the complainant’s ability to place an emergency call or to request assistance in an emergency from a law enforcement agency, medical facility, or other agency whose primary purpose is the safety of individuals.', 'The defendant did so knowingly.'],
    definitions: [{ term: 'Emergency', text: 'A condition or circumstance in which any individual is or is reasonably believed by the individual making a call or requesting assistance to be in fear of imminent assault or in which property is or is reasonably believed by the individual making the call or requesting assistance to be in imminent danger of damage or destruction. (PC §42.062(d))' }, D.knowingly],
  },

  /* ── Intoxication & drugs ── */
  {
    key: 'pc-49.04', group: 'Intoxication & drugs', name: 'Driving While Intoxicated', statute: 'Texas Penal Code §49.04(a)',
    summary: 'The defendant is charged with operating a motor vehicle in a public place while intoxicated.',
    elements: [VENUE, 'The defendant operated a motor vehicle.', 'The defendant did so in a public place.', 'The defendant was intoxicated while operating the motor vehicle.'],
    definitions: [D.intoxicated, D.publicPlace, { term: 'Motor vehicle', text: 'A device in, on, or by which a person or property is or may be transported or drawn on a highway, except a device used exclusively on stationary rails or tracks. (PC §32.34(a)(2))' }, { term: 'Alcohol concentration', text: 'The number of grams of alcohol per 210 liters of breath, per 100 milliliters of blood, or per 67 milliliters of urine. (PC §49.01(1))' }],
  },
  {
    key: 'pc-49.02', group: 'Intoxication & drugs', name: 'Public Intoxication', statute: 'Texas Penal Code §49.02(a)',
    summary: 'The defendant is charged with appearing in a public place while intoxicated to the degree that the defendant may have endangered the defendant or another person.',
    elements: [VENUE, 'The defendant appeared in a public place.', 'The defendant was intoxicated.', 'The defendant was intoxicated to the degree that the defendant may have endangered the defendant or another person.'],
    definitions: [D.intoxicated, D.publicPlace],
  },
  {
    key: 'hsc-481.121', group: 'Intoxication & drugs', name: 'Possession of Marihuana', statute: 'Texas Health and Safety Code §481.121(a)',
    summary: 'The defendant is charged with knowingly or intentionally possessing a usable quantity of marihuana. The amount possessed sets the level of the offense.',
    elements: [VENUE, 'The defendant possessed a usable quantity of marihuana.', 'The defendant did so knowingly or intentionally.', 'The amount possessed was within the range alleged.'],
    definitions: [{ term: 'Possession', text: 'Actual care, custody, control, or management. (HSC §481.002(38))' }, D.intentionally, D.knowingly],
  },
  {
    key: 'hsc-481.115', group: 'Intoxication & drugs', name: 'Possession of a Controlled Substance (Penalty Group 1)', statute: 'Texas Health and Safety Code §481.115(a)',
    summary: 'The defendant is charged with knowingly or intentionally possessing a controlled substance listed in Penalty Group 1. The amount possessed sets the level of the offense.',
    elements: [VENUE, 'The defendant possessed a controlled substance listed in Penalty Group 1, namely the substance alleged.', 'The defendant did so knowingly or intentionally.', 'The amount possessed, including any adulterants or dilutants, was within the range alleged.'],
    definitions: [{ term: 'Possession', text: 'Actual care, custody, control, or management. (HSC §481.002(38))' }, D.intentionally, D.knowingly],
  },
  {
    key: 'hsc-481.125', group: 'Intoxication & drugs', name: 'Possession of Drug Paraphernalia', statute: 'Texas Health and Safety Code §481.125(a)',
    summary: 'The defendant is charged with knowingly or intentionally possessing drug paraphernalia with intent to use it with a controlled substance.',
    elements: [VENUE, 'The defendant possessed drug paraphernalia.', 'The defendant intended to use it to plant, propagate, cultivate, grow, harvest, manufacture, compound, convert, produce, process, prepare, test, analyze, pack, repack, store, contain, or conceal a controlled substance, or to inject, ingest, inhale, or otherwise introduce a controlled substance into the human body.', 'The defendant did so knowingly or intentionally.'],
    definitions: [{ term: 'Possession', text: 'Actual care, custody, control, or management. (HSC §481.002(38))' }, D.intentionally, D.knowingly],
  },

  /* ── Obstruction ── */
  {
    key: 'pc-38.03', group: 'Obstruction', name: 'Resisting Arrest, Search, or Transportation', statute: 'Texas Penal Code §38.03(a)',
    summary: 'The defendant is charged with intentionally preventing or obstructing a peace officer from making an arrest, search, or transportation by using force against the officer or another.',
    elements: [VENUE, 'The defendant prevented or obstructed a person the defendant knew was a peace officer, or a person acting in a peace officer’s presence and at the officer’s direction, from effecting an arrest, search, or transportation of the defendant or another.', 'The defendant did so by using force against the peace officer or another.', 'The defendant did so intentionally.'],
    definitions: [D.peaceOfficer, D.intentionally, D.knowingly],
  },
  {
    key: 'pc-38.04', group: 'Obstruction', name: 'Evading Arrest or Detention', statute: 'Texas Penal Code §38.04(a)',
    summary: 'The defendant is charged with intentionally fleeing from a person the defendant knew was a peace officer lawfully trying to arrest or detain the defendant.',
    elements: [VENUE, 'The defendant fled from a person the defendant knew was a peace officer.', 'The peace officer was attempting lawfully to arrest or detain the defendant.', 'The defendant did so intentionally.'],
    definitions: [D.peaceOfficer, D.intentionally, D.knowingly],
  },
  {
    key: 'pc-38.02-b', group: 'Obstruction', name: 'Failure to Identify – False Information', statute: 'Texas Penal Code §38.02(b)',
    summary: 'The defendant is charged with intentionally giving a false or fictitious name, residence address, or date of birth to a peace officer who had lawfully arrested or detained the defendant.',
    elements: [VENUE, 'The defendant gave a false or fictitious name, residence address, or date of birth to a peace officer.', 'The peace officer had lawfully arrested or lawfully detained the defendant, or had requested the information from the defendant with good cause to believe the defendant was a witness to a criminal offense.', 'The defendant did so intentionally.'],
    definitions: [D.peaceOfficer, D.intentionally],
  },

  /* ── Traffic (Transportation Code) ── */
  {
    key: 'tc-545.351', group: 'Traffic (Transportation Code)', name: 'Speeding', statute: 'Texas Transportation Code §545.351, §545.352',
    summary: 'The defendant is charged with driving faster than was reasonable and prudent under the conditions. Driving faster than the posted limit is prima facie evidence that the speed was not reasonable and prudent.',
    elements: [VENUE, 'The defendant operated a motor vehicle on a public highway or street.', 'The defendant drove at a speed greater than was reasonable and prudent under the circumstances then existing.'],
    definitions: [{ term: 'Prima facie speed limit', text: 'A speed in excess of the limit established by law or posted for the location is prima facie evidence that the speed is not reasonable and prudent and that the speed is unlawful. (TC §545.352(a))' }],
  },
  {
    key: 'tc-544.007', group: 'Traffic (Transportation Code)', name: 'Disregarding a Red Traffic Signal', statute: 'Texas Transportation Code §544.007(d)',
    summary: 'The defendant is charged with failing to stop and remain stopped at a steady red signal.',
    elements: [VENUE, 'The defendant operated a vehicle facing only a steady red signal.', 'The defendant failed to stop at the clearly marked stop line, or before entering the crosswalk or intersection, and remain stopped until an indication to proceed was shown (apart from a lawful turn).'],
    definitions: [],
  },
  {
    key: 'tc-601.191', group: 'Traffic (Transportation Code)', name: 'Failure to Maintain Financial Responsibility', statute: 'Texas Transportation Code §601.191, §601.051',
    summary: 'The defendant is charged with operating a motor vehicle without the required liability insurance or other financial responsibility.',
    elements: [VENUE, 'The defendant operated a motor vehicle in this state.', 'Financial responsibility (such as a motor vehicle liability insurance policy) was not established for the vehicle.'],
    definitions: [],
  },
  {
    key: 'tc-521.457', group: 'Traffic (Transportation Code)', name: 'Driving While License Invalid', statute: 'Texas Transportation Code §521.457(a)',
    summary: 'The defendant is charged with operating a motor vehicle on a highway while the defendant’s driver’s license was suspended or revoked.',
    elements: [VENUE, 'The defendant operated a motor vehicle on a highway.', 'At the time, the defendant’s driver’s license or privilege was suspended or revoked under state law, or the defendant was otherwise prohibited from obtaining a license.'],
    definitions: [],
  },
]

export const TEXAS_OFFENSE_GROUPS = [...new Set(TEXAS_OFFENSES.map((o) => o.group))]

/** The catalog entry a count was filled from, matched by its statute and name. */
export const offenseOf = (count) => TEXAS_OFFENSES.find((o) => o.statute === count.statute && count.label.endsWith(o.name))?.key ?? ''
