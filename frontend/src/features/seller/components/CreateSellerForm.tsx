import { useState, type FormEvent } from 'react';

import { useCreateSellerProfileMutation } from '../api/sellerProfileApi';
import type { CreateSellerProfileResponse } from '../types/sellerProfile.types';
import { getApiErrorMessage } from '@/services/api/apiError';

interface CreateSellerFormProps {
  onSuccess: (response: CreateSellerProfileResponse) => void;
}

export function CreateSellerForm({ onSuccess }: CreateSellerFormProps) {
  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [createSellerProfile, { isLoading }] = useCreateSellerProfileMutation();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    const name = storeName.trim();

    if (name.length < 2 || name.length > 100) {
      setErrorMessage('El nombre de la tienda debe tener entre 2 y 100 caracteres.');
      return;
    }

    if (description.length > 2000) {
      setErrorMessage('La descripción no puede superar los 2000 caracteres.');
      return;
    }

    try {
      const response = await createSellerProfile({
        storeName: name,
        description,
      }).unwrap();

      onSuccess(response);
    } catch (error: unknown) {
      setErrorMessage(
        getApiErrorMessage(error, 'No se ha podido crear la tienda. Inténtalo de nuevo.'),
      );
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-6 rounded-xl border p-6"
    >
      <div>
        <label htmlFor="storeName" className="mb-2 block font-medium">
          Nombre de la tienda
        </label>

        <input
          id="storeName"
          type="text"
          value={storeName}
          onChange={(event) => setStoreName(event.target.value)}
          minLength={2}
          maxLength={100}
          required
          className="w-full rounded-lg border px-4 py-2"
          placeholder="Ej. PokéCards Madrid"
        />

        <p className="mt-1 text-xs text-gray-500">Entre 2 y 100 caracteres. Debe ser único.</p>
      </div>

      <div>
        <label htmlFor="description" className="mb-2 block font-medium">
          Descripción (opcional)
        </label>

        <textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={2000}
          rows={5}
          className="w-full rounded-lg border px-4 py-2"
          placeholder="Describe qué tipo de cartas vendes..."
        />

        <p className="mt-1 text-right text-xs text-gray-500">
          {description.length} / 2000 caracteres
        </p>
      </div>

      {errorMessage && (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50"
      >
        {isLoading ? 'Creando tienda...' : 'Crear mi tienda'}
      </button>
    </form>
  );
}
