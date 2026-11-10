-- English counterpart for every active built-in Persian quiz question.
-- Option order and correct_option letters intentionally match the Persian bank.
WITH english_bank(
  category, difficulty, question_text,
  option_a, option_b, option_c, option_d,
  correct_option, explanation
) AS (
  VALUES
    ('general', 'EASY', 'What is the capital of Iran?', 'Tabriz', 'Tehran', 'Isfahan', 'Shiraz', 'B', 'Tehran is the capital of Iran.'),
    ('science', 'EASY', 'At what temperature does water boil at standard atmospheric pressure?', '50°C', '75°C', '100°C', '150°C', 'C', 'At standard atmospheric pressure, water boils at 100°C.'),
    ('science', 'EASY', 'Which gas makes up the largest share of Earth''s atmosphere?', 'Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen', 'B', 'About 78% of Earth''s atmosphere is nitrogen.'),
    ('general', 'EASY', 'How many days are in a common year?', '360', '365', '366', '370', 'B', 'A common year has 365 days.'),
    ('science', 'EASY', 'Which of the following is a metal?', 'Iron', 'Sulfur', 'Oxygen', 'Carbon', 'A', 'Iron is a metallic chemical element.'),
    ('geography', 'EASY', 'Which is the largest continent by area?', 'Africa', 'Asia', 'Europe', 'South America', 'B', 'Asia is the largest continent by area.'),
    ('geography', 'MEDIUM', 'Which strait connects the Mediterranean Sea to the Atlantic Ocean?', 'The Bosporus', 'The Strait of Hormuz', 'The Strait of Gibraltar', 'Bab el-Mandeb', 'C', 'The Strait of Gibraltar lies between Spain and Morocco and connects the Mediterranean Sea with the Atlantic Ocean.'),
    ('geography', 'HARD', 'Which country completely surrounds Lesotho?', 'Namibia', 'South Africa', 'Botswana', 'Zimbabwe', 'B', 'Lesotho is an enclave entirely surrounded by South Africa.'),
    ('history', 'EASY', 'Persepolis was built during which dynasty?', 'The Sasanian dynasty', 'The Parthian dynasty', 'The Achaemenid dynasty', 'The Safavid dynasty', 'C', 'Construction of the Persepolis complex began during the Achaemenid period.'),
    ('history', 'MEDIUM', 'In which ancient city was the Cyrus Cylinder discovered?', 'Babylon', 'Susa', 'Persepolis', 'Ecbatana', 'A', 'The clay Cyrus Cylinder was discovered in ancient Babylon.'),
    ('history', 'HARD', 'The Battle of Marathon was fought between the Greeks and which empire?', 'The Roman Empire', 'The Achaemenid Empire', 'The Ottoman Empire', 'The Macedonian Empire', 'B', 'The Battle of Marathon took place during the Greco-Persian Wars.'),
    ('science', 'EASY', 'Which planet is known as the Red Planet?', 'Venus', 'Mars', 'Jupiter', 'Mercury', 'B', 'Iron oxides on the surface of Mars give it its reddish appearance.'),
    ('science', 'MEDIUM', 'What is the chemical symbol for sodium?', 'S', 'So', 'Na', 'Sd', 'C', 'The symbol Na comes from sodium''s Latin name, natrium.'),
    ('science', 'EASY', 'Which particle carries a negative electric charge?', 'Proton', 'Neutron', 'Electron', 'Positron', 'C', 'An electron has a negative electric charge.'),
    ('sports', 'EASY', 'How many players does each football team have on the field at the start of a match?', '9', '10', '11', '12', 'C', 'A standard football team starts a match with 11 players on the field.'),
    ('sports', 'MEDIUM', 'What type of court is used at the Wimbledon tennis championships?', 'Clay', 'Grass', 'Hard court', 'Wood', 'B', 'Wimbledon is the only Grand Slam tournament played on grass courts.'),
    ('sports', 'EASY', 'Which chess piece can jump over other pieces?', 'Rook', 'Bishop', 'Knight', 'Queen', 'C', 'The knight is the only chess piece that can jump over other pieces.'),
    ('literature', 'EASY', 'Who wrote the Persian epic Shahnameh?', 'Saadi', 'Ferdowsi', 'Hafez', 'Rumi', 'B', 'The Shahnameh is the epic poem by Abu''l-Qasem Ferdowsi.'),
    ('literature', 'MEDIUM', 'Who wrote the book Golestan?', 'Nezami', 'Attar', 'Saadi', 'Omar Khayyam', 'C', 'Golestan is one of the best-known works of the Persian poet Saadi.'),
    ('literature', 'HARD', 'Who wrote the novel Don Quixote?', 'Victor Hugo', 'Miguel de Cervantes', 'Charles Dickens', 'Fyodor Dostoevsky', 'B', 'Don Quixote was written by the Spanish author Miguel de Cervantes.'),
    ('art', 'EASY', 'Which art form uses a camera to capture images?', 'Sculpture', 'Photography', 'Architecture', 'Calligraphy', 'B', 'Photography is the art and practice of capturing images with a camera.'),
    ('art', 'EASY', 'Who painted the Mona Lisa?', 'Vincent van Gogh', 'Pablo Picasso', 'Leonardo da Vinci', 'Claude Monet', 'C', 'The Mona Lisa is a famous painting by Leonardo da Vinci.'),
    ('art', 'MEDIUM', 'In which country did the Impressionist art movement first emerge?', 'Italy', 'France', 'Germany', 'The Netherlands', 'B', 'Impressionism emerged in France during the nineteenth century.'),
    ('religion', 'EASY', 'What is the holy book of Islam?', 'The Torah', 'The Bible', 'The Quran', 'The Avesta', 'C', 'The Quran is the holy book of Islam.'),
    ('religion', 'EASY', 'In the Islamic lunar calendar, which month is Ramadan?', 'The eighth', 'The ninth', 'The tenth', 'The eleventh', 'B', 'Ramadan is the ninth month of the Islamic lunar calendar.'),
    ('religion', 'HARD', 'In Islamic texts, which prophet is referred to by the title Dhu al-Nun?', 'Jonah', 'Moses', 'Joseph', 'David', 'A', 'Dhu al-Nun is a title associated with the prophet Jonah.'),
    ('culture', 'EASY', 'Which season begins with Nowruz in the Northern Hemisphere?', 'Spring', 'Summer', 'Autumn', 'Winter', 'A', 'Nowruz coincides with the spring equinox and the beginning of spring in the Northern Hemisphere.'),
    ('culture', 'MEDIUM', 'The traditional Persian tar belongs to which family of musical instruments?', 'Wind', 'String', 'Percussion', 'Electronic', 'B', 'The tar is a plucked string instrument.'),
    ('culture', 'HARD', 'The earliest known cuneiform writing emerged in which ancient Mesopotamian civilization?', 'Sumer', 'Phoenicia', 'Rome', 'Ptolemaic Egypt', 'A', 'Some of the earliest known cuneiform writing developed in ancient Sumer.'),
    ('technology', 'MEDIUM', 'Which unit is commonly used to express the size of digital files?', 'Meter', 'Byte', 'Watt', 'Hertz', 'B', 'A byte is a commonly used unit for expressing digital file sizes.'),
    ('technology', 'MEDIUM', 'Which protocol is commonly used to transfer web pages securely?', 'HTTP', 'FTP', 'HTTPS', 'SMTP', 'C', 'HTTPS protects web communication using TLS encryption.'),
    ('technology', 'HARD', 'How many bits are used in an IPv4 address?', '16', '32', '64', '128', 'B', 'An IPv4 address consists of 32 bits.'),
    ('general', 'EASY', 'How many hours are in a full day?', '12', '18', '24', '30', 'C', 'A full day has 24 hours.'),
    ('general', 'EASY', 'What value does the Roman numeral X represent?', '5', '10', '50', '100', 'B', 'In Roman numerals, X represents 10.'),
    ('general', 'MEDIUM', 'What is the sum of the interior angles of a simple hexagon?', '540°', '600°', '720°', '900°', 'C', 'The sum is (n − 2) × 180°; for a hexagon, it is 720°.'),
    ('geography', 'EASY', 'What is the capital of France?', 'Rome', 'Paris', 'Berlin', 'Madrid', 'B', 'Paris is the capital of France.'),
    ('science', 'EASY', 'Which is the largest planet in the Solar System?', 'Earth', 'Saturn', 'Jupiter', 'Neptune', 'C', 'Jupiter is the largest planet in the Solar System by both diameter and mass.'),
    ('geography', 'EASY', 'What is the highest mountain peak in the world above mean sea level?', 'Mount Damavand', 'Mount Everest', 'Mount Kilimanjaro', 'Mont Blanc', 'B', 'Mount Everest, in the Himalayas, is Earth''s highest point above mean sea level.'),
    ('geography', 'EASY', 'Which is the largest ocean on Earth?', 'The Atlantic Ocean', 'The Indian Ocean', 'The Pacific Ocean', 'The Arctic Ocean', 'C', 'The Pacific Ocean is the largest ocean by area.'),
    ('science', 'EASY', 'Which organ circulates blood through the body by contracting regularly?', 'The liver', 'The heart', 'The stomach', 'The kidneys', 'B', 'The heart pumps blood through the circulatory system by contracting regularly.'),
    ('science', 'MEDIUM', 'What is the chemical symbol for gold?', 'Ag', 'Au', 'Fe', 'Cu', 'B', 'The symbol Au comes from the Latin word for gold, aurum.'),
    ('geography', 'EASY', 'Which European country is commonly described as being shaped like a boot?', 'Spain', 'Italy', 'Greece', 'Portugal', 'B', 'The Italian Peninsula is often compared to the shape of a boot.'),
    ('culture', 'MEDIUM', 'What is the official language of Brazil?', 'Spanish', 'Portuguese', 'English', 'French', 'B', 'Portuguese is the official language of Brazil.'),
    ('science', 'EASY', 'What is the largest living mammal?', 'The African elephant', 'The blue whale', 'The giraffe', 'The rhinoceros', 'B', 'The blue whale is the largest living mammal and the largest known living animal.'),
    ('geography', 'EASY', 'What is the capital of Egypt?', 'Alexandria', 'Cairo', 'Giza', 'Luxor', 'B', 'Cairo is the capital of Egypt.'),
    ('geography', 'MEDIUM', 'What is the world''s largest hot desert?', 'The Gobi Desert', 'The Kalahari Desert', 'The Sahara Desert', 'The Atacama Desert', 'C', 'The Sahara is the world''s largest hot desert.'),
    ('science', 'MEDIUM', 'Which physicist is most closely associated with the theory of relativity?', 'Isaac Newton', 'Albert Einstein', 'Galileo Galilei', 'Charles Darwin', 'B', 'Albert Einstein developed the theories of special and general relativity.'),
    ('history', 'MEDIUM', 'In which modern country is the ancient city of Petra located?', 'Egypt', 'Jordan', 'Syria', 'Lebanon', 'B', 'The archaeological site of Petra is located in Jordan.'),
    ('science', 'MEDIUM', 'What is the most abundant element in the known universe?', 'Oxygen', 'Iron', 'Hydrogen', 'Carbon', 'C', 'Hydrogen is the most abundant element in the universe and makes up much of the material in stars.'),
    ('geography', 'MEDIUM', 'Which country is commonly nicknamed the Land of a Thousand Lakes?', 'Sweden', 'Finland', 'Norway', 'Iceland', 'B', 'Finland is known by this nickname because of its very large number of lakes.'),
    ('geography', 'EASY', 'Which ocean lies between eastern Africa, southern Asia, and western Australia?', 'The Atlantic Ocean', 'The Pacific Ocean', 'The Indian Ocean', 'The Southern Ocean', 'C', 'The Indian Ocean lies between these regions.'),
    ('geography', 'EASY', 'Which Italian city is famous for its network of canals?', 'Florence', 'Venice', 'Naples', 'Turin', 'B', 'Venice is famous for its canals and water-based transport.'),
    ('history', 'MEDIUM', 'In which region did the ancient Maya civilization flourish?', 'Northern Europe', 'Central America', 'Mesopotamia', 'East Asia', 'B', 'The Maya civilization developed across parts of present-day Mexico and Central America.'),
    ('geography', 'EASY', 'What is the capital of Canada?', 'Toronto', 'Vancouver', 'Montreal', 'Ottawa', 'D', 'Ottawa is the capital of Canada; Toronto is its largest city.'),
    ('science', 'HARD', 'Which metal is liquid at typical room temperature?', 'Iron', 'Mercury', 'Aluminum', 'Copper', 'B', 'Mercury is liquid at typical room temperature.'),
    ('history', 'MEDIUM', 'Machu Picchu is a historic site built by which pre-Columbian civilization?', 'The Maya', 'The Inca', 'The Aztec', 'The Olmec', 'B', 'Machu Picchu is one of the best-known sites of the Inca civilization in present-day Peru.'),
    ('geography', 'MEDIUM', 'What is the world''s largest island, excluding continents?', 'Madagascar', 'Greenland', 'Borneo', 'New Guinea', 'B', 'Greenland is the world''s largest island when continents are excluded.'),
    ('science', 'HARD', 'Which planet takes the longest time to complete one orbit around the Sun?', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'D', 'Neptune takes about 165 Earth years to complete one orbit around the Sun.'),
    ('science', 'HARD', 'Who formulated the well-known laws of planetary motion based on observational data?', 'Johannes Kepler', 'Galileo Galilei', 'Isaac Newton', 'Nicolaus Copernicus', 'A', 'Johannes Kepler formulated the three laws of planetary motion using observational data.'),
    ('geography', 'EASY', 'What is the capital of Hungary?', 'Prague', 'Budapest', 'Bucharest', 'Warsaw', 'B', 'Budapest is the capital of Hungary, and the Danube River flows through it.'),
    ('history', 'HARD', 'Ziggurats were characteristic structures of which ancient region?', 'Egypt', 'Mesopotamia', 'Greece', 'Rome', 'B', 'Ziggurats were stepped temple structures built in ancient Mesopotamia.'),
    ('science', 'HARD', 'Which part of the brain plays a major role in coordinating movement and maintaining balance?', 'The cerebellum', 'The hypothalamus', 'The frontal lobe', 'The thalamus', 'A', 'The cerebellum plays an important role in balance, coordination, and fine control of movement.'),
    ('science', 'MEDIUM', 'Which gas do plants absorb from the air during photosynthesis?', 'Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium', 'C', 'Plants use carbon dioxide to produce organic compounds during photosynthesis.'),
    ('history', 'HARD', 'In which country is the historic Angkor Wat temple complex located?', 'Thailand', 'Cambodia', 'Vietnam', 'Laos', 'B', 'Angkor Wat is a historic temple complex in Cambodia associated with the Khmer civilization.'),
    ('science', 'MEDIUM', 'What is the atomic number of carbon?', '4', '5', '6', '8', 'C', 'Carbon has atomic number 6, meaning that each carbon nucleus contains six protons.')
)
INSERT INTO quiz_questions (
  language_code, category, category_id, difficulty, question_text,
  option_a, option_b, option_c, option_d,
  correct_option, explanation, status, source_type,
  metadata
)
SELECT
  'en',
  b.category,
  c.id,
  b.difficulty,
  b.question_text,
  b.option_a,
  b.option_b,
  b.option_c,
  b.option_d,
  b.correct_option,
  b.explanation,
  'ACTIVE',
  'CURATED',
  '{"translated_from":"fa","translation_reviewed":true}'::JSONB
FROM english_bank b
JOIN quiz_categories c ON c.slug = b.category
WHERE NOT EXISTS (
  SELECT 1
  FROM quiz_questions existing
  WHERE existing.language_code = 'en'
    AND LOWER(REGEXP_REPLACE(BTRIM(existing.question_text), '[[:space:][:punct:]]+', '', 'g')) =
        LOWER(REGEXP_REPLACE(BTRIM(b.question_text), '[[:space:][:punct:]]+', '', 'g'))
);

-- Refresh category IDs and English category labels.
UPDATE quiz_categories
SET name_en = CASE slug
  WHEN 'geography' THEN 'Geography'
  WHEN 'history' THEN 'History'
  WHEN 'science' THEN 'Science'
  WHEN 'sports' THEN 'Sports'
  WHEN 'literature' THEN 'Literature and Language'
  WHEN 'art' THEN 'Art and Cinema'
  WHEN 'religion' THEN 'Religion'
  WHEN 'culture' THEN 'Culture'
  WHEN 'technology' THEN 'Technology'
  WHEN 'general' THEN 'General Knowledge'
  ELSE name_en
END,
updated_at = NOW()
WHERE slug IN (
  'geography','history','science','sports','literature',
  'art','religion','culture','technology','general'
);

UPDATE quiz_questions q
SET category_id = c.id
FROM quiz_categories c
WHERE q.category = c.slug
  AND q.language_code IN ('fa','en')
  AND q.category_id IS DISTINCT FROM c.id;
