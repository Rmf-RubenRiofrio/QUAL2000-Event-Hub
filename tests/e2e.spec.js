const { test, expect } = require("@playwright/test");
require("dotenv").config();

function uniqueUser() {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  return {
    name: `QA User ${stamp}`,
    email: `qa-user-${stamp}@example.com`,
    password: "Password123",
  };
}

function uniqueEvent() {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  return {
    title: `QA Automation Expo ${stamp}`,
    updatedTitle: `QA Automation Expo Updated ${stamp}`,
    date: "2026-09-10",
    updatedDate: "2026-09-11",
    location: "Kingston Test Hall",
    updatedLocation: "Kingston Innovation Centre",
    category: "Technology",
    updatedCategory: "Workshop",
    image:
      "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
    description: "Playwright-generated event for QA execution coverage.",
    updatedDescription:
      "Updated Playwright-generated event for QA execution coverage.",
    availableSlots: "25",
    updatedSlots: "30",
  };
}

async function disableNativeValidation(page, formSelector = "form") {
  await page.locator(formSelector).evaluate((form) => {
    form.setAttribute("novalidate", "novalidate");
  });
}

async function fillEventForm(page, event) {
  await page.getByLabel("Event Title").fill(event.title);
  await page.getByLabel("Event Date").fill(event.date);
  await page.getByLabel("Location").fill(event.location);
  await page.getByLabel("Category").fill(event.category);
  await page.getByLabel("Image URL").fill(event.image);
  await page.getByLabel("Description").fill(event.description);
  await page.getByLabel("Available Slots").fill(event.availableSlots);
}

async function createEventAsAdmin(page, overrides = {}) {
  const event = { ...uniqueEvent(), ...overrides };

  await loginAdmin(page);
  await page.getByRole("link", { name: "Add New Event" }).click();
  await fillEventForm(page, event);
  await page.getByRole("button", { name: "Create Event" }).click();

  await expect(page).toHaveURL(/\/admin\/events/);
  await expect(page.getByText("Event created successfully.")).toBeVisible();
  await expect(page.locator(".admin-table")).toContainText(event.title);

  return event;
}

async function registerUser(page, user) {
  await page.goto("/register");
  await page.getByLabel("Full Name").fill(user.name);
  await page.getByLabel("Email Address").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/events\/registrations/);
}

async function loginUser(page, user) {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL(/\/events\/registrations/);
}

async function loginAdmin(page) {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env");
  }

  await page.goto("/admin/login");
  await page.getByLabel("Admin Username").fill(username);
  await page.getByLabel("Admin Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/admin\/events/);
}

async function openFirstEvent(page) {
  await page.goto("/events");
  const firstEvent = page.locator(".event-card-link").first();
  await expect(firstEvent).toBeVisible();
  await firstEvent.click();
  await expect(page).toHaveURL(/\/events\/[a-f0-9]{24}$/);
}

test("public smoke coverage: home, directory, and event details", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Event Hub" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse Events" })).toBeVisible();

  await page.getByRole("link", { name: "Browse Events" }).first().click();
  await expect(page).toHaveURL("/events");
  await expect(
    page.getByRole("heading", { name: "Explore the full Event Hub lineup." })
  ).toBeVisible();

  const firstEvent = page.locator(".event-card-link").first();
  await expect(firstEvent).toBeVisible();
  await firstEvent.click();

  await expect(page.locator(".detail-title")).toContainText("Plan your visit");
  await expect(page.getByRole("link", { name: "Back To Events" })).toBeVisible();
});

test("user registration, login redirect, and logout", async ({ page }) => {
  const user = uniqueUser();

  await registerUser(page, user);
  await expect(
    page.getByText("Your account has been created successfully.")
  ).toBeVisible();

  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("You have been logged out.")).toBeVisible();

  await loginUser(page, user);
  await expect(page.getByText("You are now logged in.")).toBeVisible();
});

test("negative user login shows validation message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email Address").fill("not-a-user@example.com");
  await page.getByLabel("Password").fill("WrongPassword");
  await page.getByRole("button", { name: "Log In" }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByText("Incorrect email address or password.")
  ).toBeVisible();
});

test("duplicate account registration is rejected", async ({ page }) => {
  const user = uniqueUser();

  await registerUser(page, user);
  await page.getByRole("button", { name: "Log Out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto("/register");
  await page.getByLabel("Full Name").fill(user.name);
  await page.getByLabel("Email Address").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL(/\/register/);
  await expect(
    page.getByText("An account already exists for that email address.")
  ).toBeVisible();
});

test("blank registration form shows server-side validation message", async ({
  page,
}) => {
  await page.goto("/register");
  await disableNativeValidation(page);
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page).toHaveURL(/\/register/);
  await expect(
    page.getByText("Please complete every account field.")
  ).toBeVisible();
});

test("custom 404 page renders recovery navigation", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");

  await expect(
    page.getByRole("heading", { name: "That page is not part of Event Hub." })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Return Home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse Events" })).toBeVisible();
});

test("invalid event ids render the custom 404 page", async ({ page }) => {
  await page.goto("/events/not-a-valid-id");
  await expect(
    page.getByRole("heading", { name: "That page is not part of Event Hub." })
  ).toBeVisible();

  await page.goto("/events/507f1f77bcf86cd799439011");
  await expect(
    page.getByRole("heading", { name: "That page is not part of Event Hub." })
  ).toBeVisible();
});

test("registration lifecycle: create, edit seats, calendar, and remove", async ({
  page,
}) => {
  const user = uniqueUser();

  await registerUser(page, user);
  await openFirstEvent(page);

  await page.getByRole("link", { name: "Register For This Event" }).click();
  await page.getByLabel("Seat Count").fill("2");
  await page.getByRole("button", { name: "Add To My Calendar" }).click();

  await expect(page).toHaveURL(/\/events\/registrations/);
  await expect(
    page.getByText("Registration created successfully.")
  ).toBeVisible();
  await expect(page.locator(".registrations-table")).toContainText("Confirmed");

  await page.getByRole("link", { name: "Edit Seats" }).first().click();
  await page.getByLabel("Seat Count").fill("3");
  await page.getByRole("button", { name: "Save Seat Changes" }).click();

  await expect(
    page.getByText("Registration updated successfully.")
  ).toBeVisible();
  await expect(page.locator(".registrations-table tbody tr").first()).toContainText(
    "3"
  );

  await page.getByRole("link", { name: "Open My Calendar" }).click();
  await expect(page).toHaveURL(/\/events\/registrations\/calendar/);
  await expect(
    page.getByRole("heading", { name: "See your saved events in one calendar." })
  ).toBeVisible();
  await page.getByRole("link", { name: "Next Month" }).click();
  await expect(page.locator(".calendar-event").first()).toBeVisible();
  await expect(page.locator(".agenda-column").first()).toContainText("Seats:");

  await page.goto("/events/registrations");
  await page.getByRole("button", { name: "Remove Event" }).first().click();
  await expect(
    page.getByText("Registration removed from your calendar.")
  ).toBeVisible();
});

test("registration validation rejects invalid seat count", async ({ page }) => {
  const user = uniqueUser();

  await registerUser(page, user);
  await openFirstEvent(page);

  await page.getByRole("link", { name: "Register For This Event" }).click();
  await page.getByLabel("Seat Count").evaluate((input) => {
    input.removeAttribute("min");
    input.removeAttribute("max");
    input.value = "0";
  });
  await page.getByRole("button", { name: "Add To My Calendar" }).click();

  await expect(
    page.getByText("Please choose a whole number of seats between 1 and 10.")
  ).toBeVisible();
});

test("duplicate registration redirects to the edit seats page", async ({
  page,
}) => {
  const user = uniqueUser();

  await registerUser(page, user);
  await openFirstEvent(page);
  const eventUrl = page.url();

  await page.getByRole("link", { name: "Register For This Event" }).click();
  await page.getByLabel("Seat Count").fill("1");
  await page.getByRole("button", { name: "Add To My Calendar" }).click();
  await expect(page.getByText("Registration created successfully.")).toBeVisible();

  await page.goto(`${eventUrl}/register`);
  await expect(page).toHaveURL(/\/events\/registrations\/[a-f0-9]{24}\/edit/);
  await expect(
    page.getByText("You already joined this event. Update your seats here.")
  ).toBeVisible();
});

test("edit seats rejects invalid negative and over-limit values", async ({
  page,
}) => {
  const user = uniqueUser();

  await registerUser(page, user);
  await openFirstEvent(page);
  await page.getByRole("link", { name: "Register For This Event" }).click();
  await page.getByLabel("Seat Count").fill("2");
  await page.getByRole("button", { name: "Add To My Calendar" }).click();
  await page.getByRole("link", { name: "Edit Seats" }).first().click();

  await page.getByLabel("Seat Count").evaluate((input) => {
    input.removeAttribute("min");
    input.removeAttribute("max");
    input.value = "-1";
  });
  await page.getByRole("button", { name: "Save Seat Changes" }).click();
  await expect(
    page.getByText("Please choose a whole number of seats between 1 and 10.")
  ).toBeVisible();

  await page.getByLabel("Seat Count").evaluate((input) => {
    input.removeAttribute("min");
    input.removeAttribute("max");
    input.value = "11";
  });
  await page.getByRole("button", { name: "Save Seat Changes" }).click();
  await expect(
    page.getByText("Please choose a whole number of seats between 1 and 10.")
  ).toBeVisible();
});

test("registration rejects seat requests greater than remaining capacity", async ({
  page,
}) => {
  const user = uniqueUser();
  const event = await createEventAsAdmin(page, {
    title: `QA Limited Capacity ${Date.now()}`,
    availableSlots: "2",
  });

  await page.goto("/admin/events");
  await page.getByRole("button", { name: "Log Out" }).click();
  await registerUser(page, user);

  await page.goto("/events");
  const eventCard = page.locator(".event-card-link", { hasText: event.title }).first();
  await eventCard.click();
  await page.getByRole("link", { name: "Register For This Event" }).click();

  await page.getByLabel("Seat Count").evaluate((input) => {
    input.removeAttribute("max");
    input.value = "3";
  });
  await page.getByRole("button", { name: "Add To My Calendar" }).click();

  await expect(
    page.getByText("There are not enough available slots for that request.")
  ).toBeVisible();
});

test("full-capacity event is blocked from registration", async ({ page }) => {
  const user = uniqueUser();
  const event = await createEventAsAdmin(page, {
    title: `QA Full Capacity ${Date.now()}`,
    availableSlots: "0",
  });

  await page.goto("/admin/events");
  await page.getByRole("button", { name: "Log Out" }).click();
  await registerUser(page, user);
  await page.goto("/events");

  const eventCard = page.locator(".event-card-link", { hasText: event.title }).first();
  await eventCard.click();
  await expect(page.getByText("This event is full")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Register For This Event" })
  ).toHaveCount(0);
});

test("another user's registration edit route is blocked", async ({ browser }) => {
  const userOne = uniqueUser();
  const userTwo = uniqueUser();

  const pageOne = await browser.newPage();
  await registerUser(pageOne, userOne);
  await openFirstEvent(pageOne);
  await pageOne.getByRole("link", { name: "Register For This Event" }).click();
  await pageOne.getByLabel("Seat Count").fill("1");
  await pageOne.getByRole("button", { name: "Add To My Calendar" }).click();
  await pageOne.getByRole("link", { name: "Edit Seats" }).first().click();
  const editUrl = pageOne.url();
  await pageOne.close();

  const pageTwo = await browser.newPage();
  await registerUser(pageTwo, userTwo);
  await pageTwo.goto(editUrl);
  await expect(pageTwo).toHaveURL(/\/events\/registrations/);
  await expect(
    pageTwo.getByText("That registration could not be found.")
  ).toBeVisible();
  await pageTwo.close();
});

test("admin invalid login variants show error message", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Admin Username").fill(process.env.ADMIN_USERNAME || "admin");
  await page.getByLabel("Admin Password").fill("WrongAdminPassword");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(
    page.getByText("Incorrect username or password.")
  ).toBeVisible();

  await page.getByLabel("Admin Username").fill("wrongadmin");
  await page.getByLabel("Admin Password").fill(process.env.ADMIN_PASSWORD || "root");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(
    page.getByText("Incorrect username or password.")
  ).toBeVisible();
});

test("admin create form rejects invalid values", async ({ page }) => {
  await loginAdmin(page);
  await page.getByRole("link", { name: "Add New Event" }).click();
  await fillEventForm(page, {
    title: `QA Invalid Create ${Date.now()}`,
    date: "2026-09-10",
    location: "Invalid Create Hall",
    category: "Technology",
    image: "https://example.com/image.jpg",
    description: "Attempt invalid create flow.",
    availableSlots: "-1",
  });
  await page.getByRole("button", { name: "Create Event" }).click();

  await expect(page).toHaveURL(/\/admin\/events\/new/);
  const slotField = page.getByLabel("Available Slots");
  await expect(slotField).toBeFocused();
  await expect
    .poll(async () => {
      return slotField.evaluate((input) => input.validity.valid);
    })
    .toBe(false);
});

test("admin edit form rejects invalid values", async ({ page }) => {
  const event = await createEventAsAdmin(page, {
    title: `QA Invalid Edit ${Date.now()}`,
  });

  const row = page.locator(".admin-table tbody tr", { hasText: event.title }).first();
  await row.getByRole("link", { name: "Edit" }).click();
  await disableNativeValidation(page, 'form[action*="/admin/events/"]');
  await page.getByLabel("Event Title").fill("");
  await page.getByLabel("Available Slots").fill("-1");
  await page.getByRole("button", { name: "Save Changes" }).click();

  await expect(
    page.getByText("Please complete every event field correctly.")
  ).toBeVisible();
});

test("admin CRUD flow: login, create, edit, and delete event", async ({
  page,
}) => {
  const event = uniqueEvent();

  await loginAdmin(page);
  await page.getByRole("link", { name: "Add New Event" }).click();

  await page.getByLabel("Event Title").fill(event.title);
  await page.getByLabel("Event Date").fill(event.date);
  await page.getByLabel("Location").fill(event.location);
  await page.getByLabel("Category").fill(event.category);
  await page.getByLabel("Image URL").fill(event.image);
  await page.getByLabel("Description").fill(event.description);
  await page.getByLabel("Available Slots").fill(event.availableSlots);
  await page.getByRole("button", { name: "Create Event" }).click();

  await expect(page).toHaveURL(/\/admin\/events/);
  await expect(page.getByText("Event created successfully.")).toBeVisible();
  await expect(page.locator(".admin-table")).toContainText(event.title);

  await page.goto("/events");
  await expect(page.locator(".event-list")).toContainText(event.title);

  await page.goto("/admin/events");
  const row = page.locator(".admin-table tbody tr", { hasText: event.title }).first();
  await row.getByRole("link", { name: "Edit" }).click();

  await page.getByLabel("Event Title").fill(event.updatedTitle);
  await page.getByLabel("Event Date").fill(event.updatedDate);
  await page.getByLabel("Location").fill(event.updatedLocation);
  await page.getByLabel("Category").fill(event.updatedCategory);
  await page.getByLabel("Description").fill(event.updatedDescription);
  await page.getByLabel("Available Slots").fill(event.updatedSlots);
  await page.getByRole("button", { name: "Save Changes" }).click();

  await expect(page.getByText("Event updated successfully.")).toBeVisible();
  await expect(page.locator(".admin-table")).toContainText(event.updatedTitle);

  const updatedRow = page.locator(".admin-table tbody tr", {
    hasText: event.updatedTitle,
  }).first();
  await updatedRow.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByText("Event deleted successfully.")).toBeVisible();
  await expect(page.locator(".admin-table")).not.toContainText(event.updatedTitle);
});

test("admin delete route handles invalid id gracefully", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/admin/events");
  await page.evaluate(() => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/admin/events/not-a-valid-id?_method=DELETE";
    document.body.appendChild(form);
    form.submit();
  });

  await expect(page).toHaveURL(/\/admin\/events\?message=/);
  await expect(page.getByText("That event could not be found.")).toBeVisible();
});

test("admin logout returns to admin login page", async ({ page }) => {
  await loginAdmin(page);
  await page.getByRole("button", { name: "Log Out" }).click();

  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(
    page.getByRole("heading", { name: "Sign in to manage Event Hub." })
  ).toBeVisible();
});
