const fs = require('fs');
const csv = require('csv-parse/sync');

// Read the CSV file
const csvContent = fs.readFileSync('/Users/steve/yum-dashboard/scripts/Curated Thought Leaders - AI (Green is New).csv', 'utf8');

// Parse CSV
const records = csv.parse(csvContent, {
  columns: true,
  skip_empty_lines: true
});

// Existing creators from database (names only for comparison)
const existingCreators = new Set([
  "Aaron Ng", "Abhishek Thakur", "Adam Robinson", "Aidan Gomez", "Ajay Pandey",
  "Alex Graveley", "Alex J. Champandard", "Alexander Wang", "Alexandr Wang",
  "Allie K. Miller", "Allie Miller", "Allison Pickens", "Amanda Natividad",
  "Amitav Bhattacharjee", "Amjad Masad", "Andrej Karpathy", "Andrew Ng",
  "Andy Crestodina", "Andy Jankowski", "Anna Furmanov", "Antonio Grasso",
  "Apple Machine Learning Research", "April Dunford", "Ashley Faus",
  "AWS Machine Learning Blog", "Aza Raskin", "Ben Murray", "Ben Tossell",
  "Benjamin Mangold", "Bernard Marr", "Bilawal Sidhu", "Blake Bartlett",
  "Bob Gourley", "Bob Violino", "Cade Metz", "Cassie Kozyrkov", "Catherine Adenle",
  "Chris Dixon", "Chris Frantz", "Chris Messina", "Chris Walker", "Claire Silver",
  "Claire Suellentrop", "Clem Delangue", "Clément Delangue", "Dan Martell",
  "Daniel Gross", "Daphne Koller", "Dario Amodei", "Data Chaz", "Dave Gerhardt",
  "David Kenny", "David Sacks", "David Skok", "Debashis Dutta", "DeepMind",
  "Demis Hassabis", "Dev Basu", "Dharmesh Shah", "Dominic Monn", "Dr. Angelica Lim",
  "Dr. Fei Fei Li", "Elad Gil", "Eli Rubel", "Eliezer Yudkowsky", "Elon Musk",
  "Emad Mostaque", "Eric Simons", "Erik Brynjolfsson", "Fabio Moioli",
  "Fausto Pedro Garcia Marquez", "Fei-Fei Li", "Filip Drazdou", "François Chollet",
  "Gene Kogan", "Geoffrey Hinton", "Geoffrey Moore", "Giuliano Liguori", "Google AI",
  "Grant Sanderson", "Greg Brockman", "Harold Sinnott", "Harrison Kinsley",
  "Hassan Rashidi", "Helen Yu", "Hiten Shah", "Hugging Face", "Iain Brown",
  "Ian Barkin", "Ian Goodfellow", "Ilya Sutskever", "Inma Martinez", "Jack Clark",
  "Jamin Ball", "Jason Lemkin", "Jeff Dean", "Joel York", "John C. Havens",
  "John Carmack", "Jonathan Rintala", "Jordan Harrod", "Josh Starmer", "Kai-Fu Lee",
  "Karen Hao", "Karim Atiyeh", "Kate Crawford", "Kate Darling", "Katelyn Bourgoin",
  "Kathleen Walch", "Katie Staveley", "Kirk Borne", "Kunal Jain", "Kyle Poyar",
  "Latane Conant", "Lenny Rachitsky", "Less Wrong", "Lex Fridman", "Lorenzo Green",
  "Louis Bouchard", "Louis Pereira", "Lucian Fogoros", "Marc Andreessen",
  "Marcell Vollmer", "Marcus Borba", "Marek Rosa", "Mark Tabladillo", "Martin Casado",
  "Martin F. Robbins", "Martin Ford", "Matt Shumer", "Max Tegmark", "Max Welling",
  "Melanie Deziel", "Melanie Mitchell", "Meta AI", "Michael Lyon",
  "Microsoft Research Blog", "Mike Tamir", "Monica Rogati", "Nando de Freitas",
  "Nathan Benaich", "Nathan Lands", "Nathan Latka", "Neil Patel", "Nick Mehta",
  "Nicolas Babin", "Nige Roberts-Willson", "Noam Brown", "Oliver Christie",
  "Oren Etzioni", "Oriol Vinyals", "Pascal Bornet", "Patrick Campbell", "Paul Roetzer",
  "Paul Yacoubian", "Peep Laja", "Pieter Levels", "Randy Olson", "Ray Rike",
  "Richard Sutton", "Rob Lennon", "Rob Walling", "Robert Scoble", "Robin Hanson",
  "Rodney Brooks", "Roman Yampolskiy", "Ronald Schmelzer", "Ronald van Loon",
  "Ross Simmonds", "Rowan Cheung", "Ryan Allis", "Sally Eaves", "Sam Altman",
  "Sarah Burnett", "Sarah Guo", "Satya Mallick", "Scott Brinker", "Sean Ellis",
  "Sean Gardner", "Sebastian Raschka", "Sequoia Capital", "Shaan Puri", "Shane Legg",
  "Simon Høiberg", "Soumith Chintala", "Sourabh Singh Katoch", "Steli Efti",
  "Stew Fortier", "Sudalai Rajkumar", "Sven Philipsen", "Swarnendu De",
  "Swyx (Shawn Wang)", "Tamara McCleary", "Terence Leung", "Terence Mills",
  "Timnit Gebru", "TK Kader", "Toby Ord", "Tomasz Tunguz", "Tristan Harris",
  "Tuhin Srivastava", "Varun Mayya", "Vinod Khosla", "Vinod Sharma", "Wes Bush",
  "Wilhelm Bielert", "Yann LeCun", "YCombinator", "Yohei Nakajima"
]);

// Check for creators to add
const creatorsToAdd = [];
const urlsToUpdate = [];

records.forEach(record => {
  const name = record['AI Creator'];
  const description = record['Description'];
  const twitter = record['Twitter'];
  const linkedin = record['LinkedIn'];
  const blogFeed = record['Blog Feed'];
  const youtube = record['YouTube'];
  const threads = record['Threads'];
  
  // Normalize name for comparison
  const normalizedName = name.trim();
  
  // Check if creator exists
  let found = false;
  existingCreators.forEach(existing => {
    if (existing.toLowerCase() === normalizedName.toLowerCase() || 
        existing.replace(/\s+/g, '').toLowerCase() === normalizedName.replace(/\s+/g, '').toLowerCase()) {
      found = true;
    }
  });
  
  if (!found) {
    const urls = [];
    if (twitter && twitter.trim()) urls.push(twitter.trim());
    if (linkedin && linkedin.trim()) urls.push(linkedin.trim());
    if (blogFeed && blogFeed.trim()) {
      // Split multiple blog feeds by comma
      blogFeed.split(',').forEach(feed => {
        if (feed.trim()) urls.push(feed.trim());
      });
    }
    if (youtube && youtube.trim()) urls.push(youtube.trim());
    if (threads && threads.trim()) urls.push(threads.trim());
    
    creatorsToAdd.push({
      name: normalizedName,
      description: description || '',
      urls: urls
    });
  }
});

console.log(`Found ${creatorsToAdd.length} creators to add:`);
console.log(JSON.stringify(creatorsToAdd, null, 2));

// Save to file for reference
fs.writeFileSync('/Users/steve/yum-dashboard/scripts/creators-to-add.json', JSON.stringify(creatorsToAdd, null, 2));