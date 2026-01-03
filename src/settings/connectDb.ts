import { connect } from 'mongoose';

export const connectDb = async (mongoUri: string) => {
  try {
    const dbResponse = await connect(mongoUri);
    console.log(`Connected to MongoDB: ${dbResponse.connection.name}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
};
