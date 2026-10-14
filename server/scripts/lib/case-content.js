// Entirely fictional case material for the demo. Any resemblance to real people or events is coincidental.

export const CASE = {
  caption: 'People v. Dana Whitlock',
  caseNumber: '26-CR-0418',
  court: 'Millbrook County Superior Court, Part 3',
  counts: [
    { id: 'c1', label: 'Count 1: Burglary in the Third Degree' },
    { id: 'c2', label: 'Count 2: Grand Larceny in the Fourth Degree' },
    { id: 'c3', label: 'Count 3: Criminal Mischief in the Fourth Degree' },
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

export const FAMILY_UPDATES = [
  { seat: 3, body: 'Message from your daughter Priya: The school play went really well and Grandma recorded it for you. Everyone at home is fine. We love you and will see you soon.' },
  { seat: 8, body: 'Message from your partner, Sam: The dog is doing great and the mail is being picked up every day. Your Tuesday dentist appointment has been moved to next month, so no need to worry about it.' },
];
