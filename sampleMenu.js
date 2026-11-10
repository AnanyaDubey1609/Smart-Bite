// Sample menu. The last value of each row is the image file name in assets/images/food/
const rows = [
  // Starters
  ['Starters', 'Paneer Tikka', 'Smoky tandoor-grilled paneer cubes with mint chutney.', 220, 'paneer-tikka'],
  ['Starters', 'Veg Spring Rolls', 'Crispy rolls stuffed with seasoned vegetables.', 160, 'spring-rolls'],
  ['Starters', 'Crispy Corn', 'Golden fried sweet corn tossed with spices.', 150, 'crispy-corn'],
  ['Starters', 'Garlic Bread', 'Toasted bread with garlic butter and herbs.', 130, 'garlic-bread'],
  // Main Course
  ['Main Course', 'Butter Paneer Masala', 'Soft paneer in a rich creamy tomato gravy.', 280, 'paneer-masala'],
  ['Main Course', 'Dal Makhani', 'Slow-cooked black lentils finished with cream.', 240, 'dal-makhani'],
  ['Main Course', 'Veg Biryani', 'Fragrant basmati rice layered with vegetables and spices.', 260, 'veg-biryani'],
  ['Main Course', 'Butter Naan', 'Soft tandoor-baked bread brushed with butter.', 45, 'butter-naan'],
  // Pizza
  ['Pizza', 'Margherita Pizza', 'Classic tomato, mozzarella and fresh basil.', 249, 'margherita'],
  ['Pizza', 'Farmhouse Pizza', 'Loaded with onion, capsicum, mushroom and corn.', 329, 'farmhouse'],
  ['Pizza', 'Paneer Tikka Pizza', 'Tandoori paneer, onion and capsicum on a cheesy base.', 349, 'paneer-pizza'],
  ['Pizza', 'Cheese Burst Pizza', 'Extra mozzarella melting inside the crust.', 399, 'cheese-burst'],
  // Burger
  ['Burger', 'Classic Veg Burger', 'Crunchy veg patty, lettuce, tomato and house sauce.', 120, 'veg-burger'],
  ['Burger', 'Cheese Burger', 'Veg patty topped with melted cheddar.', 150, 'cheese-burger'],
  ['Burger', 'Paneer Burger', 'Crispy paneer patty with spicy mayo.', 170, 'paneer-burger'],
  ['Burger', 'Loaded Fries', 'Fries with cheese sauce and jalapenos.', 140, 'loaded-fries'],
  // Drinks
  ['Drinks', 'Fresh Lime Soda', 'Sweet or salted, served chilled.', 70, 'lime-soda'],
  ['Drinks', 'Cold Coffee', 'Thick and creamy iced coffee.', 110, 'cold-coffee'],
  ['Drinks', 'Mango Shake', 'Fresh mango blended with milk.', 120, 'mango-shake'],
  ['Drinks', 'Masala Chai', 'Hot ginger-cardamom tea.', 40, 'masala-chai'],
  // Desserts
  ['Desserts', 'Gulab Jamun', 'Two warm milk dumplings in sugar syrup.', 80, 'gulab-jamun'],
  ['Desserts', 'Chocolate Brownie', 'Warm fudgy brownie with chocolate sauce.', 140, 'brownie'],
  ['Desserts', 'Vanilla Ice Cream', 'Two scoops of classic vanilla.', 90, 'ice-cream'],
  ['Desserts', 'Rasmalai', 'Soft cheese patties in saffron milk.', 110, 'rasmalai'],
];

const items = rows.map(([category, name, description, price, slug]) => ({
  name,
  category,
  description,
  price,
  imageUrl: `/assets/images/food/${slug}.svg`,
  available: true,
}));

module.exports = items;
