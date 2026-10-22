// Entirely fictional case material for the demo. Any resemblance to real people or events is coincidental.

export const CASE = {
  caption: 'People v. Dana Whitlock',
  caseNumber: '26-CR-0418',
  court: 'Millbrook County Superior Court, Part 3',
  // Shown to jurors beside each ballot. In a real trial, paste the judge's written instructions here.
  burden:
    'The People must prove every element of a count beyond a reasonable doubt. If they have not proven any one element, you must find the defendant not guilty of that count. You must also be convinced that it was the defendant who committed the acts.',
  counts: [
    {
      id: 'c1',
      label: 'Count 1: Burglary in the Third Degree',
      statute: 'Millbrook Penal Code § 140.20',
      summary: 'A person is guilty of burglary in the third degree when they knowingly enter or remain unlawfully in a building with intent to commit a crime inside it.',
      elements: [
        "The defendant entered or remained in a building: Callan's Hardware, 412 Ferris Street.",
        'The entry or remaining was unlawful: the defendant had no license or privilege to be there at that time.',
        'The defendant knew that the entry or remaining was unlawful.',
        'When entering or remaining, the defendant intended to commit a crime inside (here, theft).',
      ],
      definitions: [
        { term: 'Enter or remain unlawfully', text: 'To be in a building without permission from the owner or anyone authorized to give it. A former employee has no permission outside working hours.' },
        { term: 'Intent', text: 'A conscious aim or objective. You may infer intent from what a person did and the surrounding circumstances.' },
      ],
    },
    {
      id: 'c2',
      label: 'Count 2: Grand Larceny in the Fourth Degree',
      statute: 'Millbrook Penal Code § 155.30',
      summary: 'A person is guilty of grand larceny in the fourth degree when they steal property and the value of the property exceeds $1,000.',
      elements: [
        'The defendant wrongfully took, obtained or withheld property.',
        "The property belonged to someone else: Callan's Hardware.",
        'The defendant did so with intent to deprive the owner of the property or to keep it for themselves or another person.',
        'The value of the property taken exceeded $1,000.',
      ],
      definitions: [
        { term: 'Value', text: 'The market value of the property at the time and place of the theft. Repair costs for damage are not counted toward the value of property taken.' },
        { term: 'Deprive', text: 'To withhold property permanently, or for so long that most of its value or benefit is lost to the owner.' },
      ],
    },
    {
      id: 'c3',
      label: 'Count 3: Criminal Mischief in the Fourth Degree',
      statute: 'Millbrook Penal Code § 145.00',
      summary: 'A person is guilty of criminal mischief in the fourth degree when, having no right to do so nor any reasonable ground to believe they have such a right, they intentionally damage the property of another person.',
      elements: [
        "The defendant damaged property: the rear service door of Callan's Hardware.",
        'The property belonged to someone else.',
        'The defendant acted intentionally, not by accident.',
        'The defendant had no right to damage the property and no reasonable ground to believe they had that right.',
      ],
      definitions: [
        { term: 'Damage', text: 'Any physical harm that impairs the value or usefulness of the property, such as pry marks that break a lock or frame.' },
      ],
    },
  ],
};

export const TRANSCRIPT_DELGADO = `
THE CLERK: Testimony of Officer Rosa Delgado, Millbrook Police Department. Direct examination by Assistant District Attorney Reyes.
Q: Officer Delgado, where were you on the night of March 14th of this year?
A: I was on patrol in sector four, which includes Ferris Street.
Q: Did you receive a call that night?
A: Yes. Dispatch reported an alarm at Callan's Hardware, 412 Ferris Street, at 11:47 p.m.
Q: When did you arrive?
A: I arrived at 11:56 p.m. and went to the rear lot first.
Q: What did you see at the rear door?
A: The steel door was ajar. There were fresh pry marks near the latch, about chest height.
Q: Did you photograph the door?
A: Yes. That is the photograph marked People's Exhibit P-2.
Q: What did you find inside?
A: The office drawer was open and the cash box was gone. Two display shelves of cordless tool kits were empty.
Q: Did you recover anything in the lot?
A: A single black work glove, right hand, about ten feet from the door.
Q: Was the glove tested?
A: It was sent to the lab. I do not have the results in front of me.
Q: Did you review security video?
A: I reviewed camera two, which faces the rear lot. A still from 11:42 p.m. is marked P-5.
MR. HADDAD: Objection, foundation as to the timestamp.
THE COURT: Overruled. You may answer.
A: The still shows one person in a hooded jacket near the rear door.
Q: Nothing further. Cross-examination by Mr. Haddad for the defense.
Q: Officer, you cannot see a face in Exhibit P-5, correct?
A: That is correct. The hood covers the face.
Q: And the camera two clock had not been checked against an official time source?
A: I am not aware that it was checked.
Q: You never matched the glove to my client?
A: I did not personally, no.
Q: Thank you. Nothing further.
THE COURT: The witness may step down.
`.trim();

export const TRANSCRIPT_OKAFOR = `
THE CLERK: Testimony of Maya Okafor, store manager at Callan's Hardware. Direct examination by Assistant District Attorney Reyes.
Q: Ms. Okafor, how long have you managed Callan's Hardware?
A: Six years this June.
Q: Do you know the defendant?
A: Yes. Dana worked for us as a stock associate until January of this year.
Q: Why did that employment end?
A: Dana took a job with Brightline Logistics. It was on good terms.
Q: Did employees have a code for the rear door?
A: Yes. Everyone on the stock team knew the keypad code.
Q: Was that code changed after the defendant left?
A: We changed it in late January, about two weeks after Dana left.
Q: Where was the cash box kept?
A: In the bottom left drawer of the office desk. That is shown on the floor plan, Exhibit P-3.
Q: How much was in it on March 14th?
A: One thousand one hundred eighty dollars, from the evening deposit we had not made yet.
Q: What else was taken?
A: Eleven cordless tool kits. Our loss statement is Exhibit P-4.
Q: What was the total value of the loss?
A: About four thousand two hundred dollars, plus the damage to the door.
Q: Thank you. Cross-examination by Mr. Haddad.
Q: Ms. Okafor, after the code changed, did anyone actually need the old one?
A: No. The old code would not have worked.
Q: So whoever came in that night did not use a code at all?
A: I would assume not, since the door was pried.
Q: How many former employees have worked in your stockroom in the last two years?
A: Maybe fifteen or so.
Q: And all of them knew where the cash box was kept?
A: Most of them, yes.
Q: Is it fair to say Dana was a reliable employee?
A: Yes. Dana was never late and never short on a count.
Q: Nothing further.
THE COURT: Thank you, Ms. Okafor. You may step down.
`.trim();

export const MENU = [
  { name: 'Turkey & Swiss on rye', category: 'Sandwiches', dietary: '' },
  { name: 'Grilled vegetable wrap', category: 'Sandwiches', dietary: 'Vegetarian' },
  { name: 'Chicken Caesar salad', category: 'Salads', dietary: '' },
  { name: 'Garden salad with chickpeas', category: 'Salads', dietary: 'Vegan, gluten-free' },
  { name: 'Tomato basil soup', category: 'Soups', dietary: 'Vegetarian' },
  { name: 'Lentil soup', category: 'Soups', dietary: 'Vegan' },
  { name: 'Fruit cup', category: 'Sides', dietary: 'Vegan, gluten-free' },
  { name: 'Coffee', category: 'Drinks', dietary: '' },
  { name: 'Herbal tea', category: 'Drinks', dietary: '' },
  { name: 'Sparkling water', category: 'Drinks', dietary: '' },
];

export const SUPPLIES = ['Notepad', 'Pens', 'Highlighters', 'Sticky notes', 'Bottled water', 'Tissues', 'Blanket', 'Reading glasses (loaner)'];
