async function testFetch() {
  try {
    const response = await fetch(process.env.CALENDAR_CREDENTIALS_URL, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_SECRET,
      },
    });

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

testFetch();
