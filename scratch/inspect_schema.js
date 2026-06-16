const url = "https://uhkvuukfuxikhfrvrqgb.supabase.co/rest/v1/";
const headers = {
  "apikey": "sb_secret_dvs6L1jyRRpqnznV5wZfSg_Gs4tPEn3",
  "Authorization": "Bearer sb_secret_dvs6L1jyRRpqnznV5wZfSg_Gs4tPEn3"
};

fetch(url, { headers })
  .then(res => res.json())
  .then(schema => {
    const messagesDefinition = schema.definitions?.messages;
    if (messagesDefinition) {
      console.log("Messages table columns:", Object.keys(messagesDefinition.properties));
    } else {
      console.log("Messages table definition not found in definitions. Definitions:", Object.keys(schema.definitions || {}));
    }
  })
  .catch(err => console.error("Error fetching schema:", err));
