const fs = require('fs');
const csv = require('csv-parse/sync');

// Read the CSV file
const csvContent = fs.readFileSync('/Users/steve/yum-dashboard/scripts/Curated Thought Leaders - AI (Green is New).csv', 'utf8');

// Parse CSV
const records = csv.parse(csvContent, {
  columns: true,
  skip_empty_lines: true
});

// Map of existing creators and their current URLs from the database query
const existingCreatorsWithUrls = {
  "Aaron Ng": null,
  "Abhishek Thakur": ["https://twitter.com/abhi1thakur"],
  "Aidan Gomez": null,
  "Ajay Pandey": null,
  "Alex Graveley": null,
  "Alexandr Wang": null,
  "Allie Miller": ["https://twitter.com/alliekmiller", "https://www.linkedin.com/in/alliekmiller"],
  "Amjad Masad": null,
  "Andy Crestodina": null,
  "Chris Frantz": null,
  "Clem Delangue": null,
  "Clément Delangue": null,
  "Daniel Gross": null,
  "Daphne Koller": null,
  "Dario Amodei": null,
  "Data Chaz": null,
  "David Kenny": null,
  "David Sacks": null,
  "Debashis Dutta": null,
  "Dominic Monn": null,
  "Dr. Angelica Lim": null,
  "Elad Gil": null,
  "Eliezer Yudkowsky": null,
  "Elon Musk": null,
  "Emad Mostaque": null,
  "Eric Simons": null,
  "Erik Brynjolfsson": null,
  "Fabio Moioli": null,
  "Fausto Pedro Garcia Marquez": null,
  "Fei-Fei Li": null,
  "François Chollet": null,
  "Gene Kogan": null,
  "Geoffrey Hinton": null,
  "Giuliano Liguori": null,
  "Harold Sinnott": null,
  "Hassan Rashidi": null,
  "Helen Yu": null,
  "Iain Brown": null,
  "Ian Barkin": null,
  "Ian Goodfellow": null,
  "Ilya Sutskever": null,
  "Inma Martinez": null,
  "Jeff Dean": null,
  "John C. Havens": null,
  "John Carmack": null,
  "Kai-Fu Lee": null,
  "Karim Atiyeh": null,
  "Kate Crawford": null,
  "Kate Darling": null,
  "Kathleen Walch": null,
  "Katie Staveley": null,
  "Kirk Borne": null,
  "Lorenzo Green": null,
  "Louis Pereira": null,
  "Lucian Fogoros": null,
  "Marc Andreessen": null,
  "Marcell Vollmer": null,
  "Marcus Borba": null,
  "Marek Rosa": null,
  "Mark Tabladillo": null,
  "Martin Casado": null,
  "Martin F. Robbins": null,
  "Martin Ford": null,
  "Matt Shumer": null,
  "Max Tegmark": null,
  "Max Welling": null,
  "Melanie Mitchell": null,
  "Mike Tamir": null,
  "Monica Rogati": null,
  "Nando de Freitas": null,
  "Nathan Lands": null,
  "Nicolas Babin": null,
  "Nige Roberts-Willson": null,
  "Noam Brown": null,
  "Oliver Christie": null,
  "Oren Etzioni": null,
  "Oriol Vinyals": null,
  "Pascal Bornet": null,
  "Paul Roetzer": null,
  "Paul Yacoubian": null,
  "Pieter Levels": null,
  "Randy Olson": null,
  "Richard Sutton": null,
  "Rob Lennon": null,
  "Robert Scoble": null,
  "Robin Hanson": null,
  "Roman Yampolskiy": null,
  "Ronald Schmelzer": null,
  "Ronald van Loon": null,
  "Ross Simmonds": null,
  "Sally Eaves": null,
  "Sarah Burnett": null,
  "Sarah Guo": null,
  "Shaan Puri": null,
  "Shane Legg": null,
  "Soumith Chintala": null,
  "Sourabh Singh Katoch": null,
  "Stew Fortier": null,
  "Sudalai Rajkumar": null,
  "Sven Philipsen": null,
  "Swyx (Shawn Wang)": null,
  "Tamara McCleary": null,
  "Terence Leung": null,
  "Terence Mills": null,
  "Timnit Gebru": null,
  "Toby Ord": null,
  "Tuhin Srivastava": null,
  "Varun Mayya": null,
  "Vinod Sharma": null,
  "Wilhelm Bielert": null,
  "Yann LeCun": null,
  "Yohei Nakajima": null
};

// Process CSV to find missing URLs for existing creators
const urlUpdates = [];

records.forEach(record => {
  const name = record['AI Creator'].trim();
  const twitter = record['Twitter'];
  const linkedin = record['LinkedIn'];
  const blogFeed = record['Blog Feed'];
  const youtube = record['YouTube'];
  const threads = record['Threads'];
  
  // Check if this creator exists but has no URLs
  for (const [existingName, existingUrls] of Object.entries(existingCreatorsWithUrls)) {
    if (existingName.toLowerCase() === name.toLowerCase() && existingUrls === null) {
      const newUrls = [];
      if (twitter && twitter.trim()) newUrls.push(twitter.trim());
      if (linkedin && linkedin.trim()) newUrls.push(linkedin.trim());
      if (blogFeed && blogFeed.trim()) {
        blogFeed.split(',').forEach(feed => {
          if (feed.trim()) newUrls.push(feed.trim());
        });
      }
      if (youtube && youtube.trim()) newUrls.push(youtube.trim());
      if (threads && threads.trim()) newUrls.push(threads.trim());
      
      if (newUrls.length > 0) {
        urlUpdates.push({
          name: existingName,
          urls: newUrls
        });
      }
      break;
    }
  }
});

console.log(`Found ${urlUpdates.length} creators that need URL updates:`);
urlUpdates.forEach(update => {
  console.log(`\n${update.name}:`);
  update.urls.forEach(url => console.log(`  - ${url}`));
});

// Save to file
fs.writeFileSync('/Users/steve/yum-dashboard/scripts/url-updates.json', JSON.stringify(urlUpdates, null, 2));