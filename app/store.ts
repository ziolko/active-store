import { createComputed } from "../lib/create-computed";
import { createQuery } from "../lib/create-query";
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { createDocument } from "../lib/firebase";

const firebaseConfig = {
  databaseURL:
    "https://dataman-c1d94-default-rtdb.europe-west1.firebasedatabase.app",
};

function createTodoApp() {
  const breedList = createQuery(() =>
    fetch("https://dog.ceo/api/breeds/list/all")
      .then((x) => x.json())
      .then((data) => Object.keys(data.message))
  );

  const breedImage = createQuery((breed: string, page: number) =>
    new Promise((x) => setTimeout(x, 500))
      .then(() => fetch(`https://dog.ceo/api/breed/${breed}/images/random`))
      .then((x) => x.json())
      .then((data) => ({ img: data.message as string, page }))
  );

  const updateSingleBreed = (breed: string, page: number) =>
    breedImage.fetch(breed, page);

  const updateAllBreeds = (page: number) => {
    return breedList
      .get()
      .data?.forEach((breed) => breedImage.fetch(breed, page));
  };

  const fb = createFirebaseStore();

  return {
    ...fb,
    getBreedList: breedList.get,
    getBreedImage: breedImage.get,
    updateSingleBreed,
    updateAllBreeds,
  };
}

const store = createTodoApp();
export default store;

function createFirebaseStore() {
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);

  const text = createDocument<string>("/todo/new", { db });
  const textLength = createComputed(() => text.get()?.length ?? 0);
  const couter = createDocument<number>("/todo/couter", { db });

  return { text, textLength, couter };
}
